"""Scoring and pipeline services for SupplyChain Sentinel.

Orchestrates math_engine primitives, SupplyGraph traversal and Pydantic models
into the complete API outputs.  No risk logic lives in API handlers; all of it
lives here.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from .math_engine import (
    Evidence,
    KalmanLeadTime,
    KalmanStressModel,
    simulate_stress_forecast,
    bayesian_update,
    concentration_score,
    monte_carlo_exposure,
    node_stress,
    prior_for_node,
    severity,
    supplier_risk_values,
    OperationalNode,
    Dependency,
)
from .models import (
    AlertCard,
    DimensionScore,
    EvidenceItem,
    Exposure,
    FactorEntry,
    MitigationOption,
    RiskSignal,
    StressTestNodeResult,
    StressTestRequest,
    StressTestResult,
    SupplierMetric,
    SupplierRiskScore,
)

if TYPE_CHECKING:
    from .graph import SupplyGraph

# Minimum ratio by which posterior must exceed prior to generate an alert.
# Prevents trivial signals from flooding the alert queue.
_ALERT_LIFT_THRESHOLD = 1.5
_ALERT_ABS_THRESHOLD  = 0.05


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


# ---------------------------------------------------------------------------
# Alert pipeline
# ---------------------------------------------------------------------------

def run_alert_pipeline(
    signals: list[RiskSignal],
    graph: "SupplyGraph",
    state: object,              # AppState (typed loosely to avoid circular import)
) -> list[AlertCard]:
    """Full live alert pipeline.

    For every node mentioned in the ingested signals:
      1. Collect all signals linked to that node via entities[] or geo-fallback.
      2. Compute a Bayesian posterior (additive log-odds, Evidence ledger).
      3. Gate: skip if the posterior is not materially elevated above the prior.
      4. Compute per-node stress (freshness-decayed, corroboration-aware).
      5. Kalman lead-time forecast (p50/p80/p95).
      6. Traverse the BOM/supply graph to count affected SKUs and orders.
      7. Compute severity (probability x impact x urgency x stress).
      8. Return sorted AlertCard list (highest severity first).

    This function is called on every POST /v1/ingest/signals, so it is
    the primary live-ingestion response mechanism.
    """
    if not signals:
        return []

    now = _utcnow()
    inventory = getattr(state, "inventory", {})

    # --- 1. Group signals by linked node ---
    node_signals: dict[str, list[RiskSignal]] = {}
    for sig in signals:
        for entity in sig.entities:
            node_signals.setdefault(entity.id, []).append(sig)
        # Geographic fallback: link to nearest supplier/port/hub when no entity match
        if not sig.entities and sig.lat is not None and sig.lon is not None:
            nearest = graph.nearest_node(sig.lat, sig.lon, kinds=["supplier", "port"])
            if nearest:
                node_signals.setdefault(nearest, []).append(sig)

    alerts: list[AlertCard] = []

    for node_id, node_sigs in node_signals.items():
        node = graph.node(node_id)
        if node is None:
            continue

        prior = prior_for_node(node.kind, node.criticality, 14)
        evidence_list: list[Evidence] = []
        stress_inputs: list[tuple[float, float, float]] = []

        for sig in node_sigs:
            # Compute signal age in days
            obs = sig.observed_at
            if obs.tzinfo is None:
                obs = obs.replace(tzinfo=timezone.utc)
            age_days = max(0.0, (now - obs).total_seconds() / 86400.0)

            # LLR: logistic transform of intensity — positive = pro-disruption evidence
            llr = math.log(
                (sig.intensity + 1e-6) / (1.0 - sig.intensity + 1e-6)
            )
            evidence_list.append(Evidence(
                name=sig.type,
                llr=llr,
                weight=sig.credibility,
                source=sig.source,
                confidence=sig.confidence,
            ))
            stress_inputs.append((sig.intensity, sig.confidence, age_days))

        # --- 2. Bayesian update ---
        posterior = bayesian_update(node_id, prior, evidence_list)

        # --- 3. Gate ---
        if (
            posterior.probability < prior * _ALERT_LIFT_THRESHOLD
            or posterior.probability < _ALERT_ABS_THRESHOLD
        ):
            continue

        # --- 4. Node stress ---
        stress = node_stress(stress_inputs)

        # --- 5. Kalman forecast ---
        kf = KalmanLeadTime(mean_days=14.0, variance=9.0, process_variance=1.5)
        fc = kf.forecast(14, posterior.probability)

        # --- 6. Downstream exposure counts ---
        downstream = graph.downstream_nodes(node_id, max_hops=5)
        sku_ids   = {nid for nid, _ in downstream if graph.node(nid) and graph.node(nid).kind == "sku"}
        order_ids = {nid for nid, _ in downstream if graph.node(nid) and graph.node(nid).kind == "order"}

        # --- 7. Severity ---
        inv = inventory.get(node_id)
        days_cover = inv.days_cover if inv else 30.0
        # Urgency rises as inventory cover shrinks below 30 days
        urgency = _clamp(1.0 - days_cover / 30.0)
        sev = severity(
            probability=posterior.probability,
            business_impact=node.criticality,
            urgency=urgency,
            concentration=stress,
        )

        avg_conf = sum(e.confidence for e in evidence_list) / max(len(evidence_list), 1)

        alert = AlertCard(
            subject_id=node_id,
            subject_kind=node.kind,
            alert_type=node_sigs[0].type if node_sigs else "unknown",
            posterior=round(posterior.probability, 4),
            prior=round(prior, 4),
            severity=sev,
            p50_days=fc.get("p50_days"),
            p80_days=fc.get("p80_days"),
            p95_days=fc.get("p95_days"),
            sku_count=len(sku_ids),
            order_count=len(order_ids),
            evidence_ledger=[
                EvidenceItem(
                    name=e.name, llr=round(e.llr, 4), weight=e.weight,
                    source=e.source, confidence=e.confidence,
                    contribution=round(e.contribution, 6),
                )
                for e in posterior.evidence
            ],
            confidence=round(avg_conf, 4),
            provenance=list({s.source for s in node_sigs}),
        )
        alerts.append(alert)

    return sorted(alerts, key=lambda a: -a.severity)


# ---------------------------------------------------------------------------
# Supplier risk scoring
# ---------------------------------------------------------------------------

def score_supplier(
    supplier_id: str,
    metrics_history: list[SupplierMetric],
    spend_share: float = 0.0,
    custom_weights: dict | None = None,
) -> SupplierRiskScore | None:
    """Score a supplier 0-100 (100 = highest risk) using 6 explainable dimensions.

    Uses math_engine.supplier_risk_values for the pure arithmetic and wraps
    the result in Pydantic models for the API layer.
    """
    if not metrics_history:
        return None

    latest = max(metrics_history, key=lambda m: m.metric_date)

    raw = supplier_risk_values(
        on_time_delivery=latest.on_time_delivery,
        quality_ppm=latest.quality_ppm,
        financial_score=latest.financial_score,
        capacity_utilization=latest.capacity_utilization,
        compliance_events=latest.compliance_events,
        spend_share=spend_share,
        weights=custom_weights,
    )

    dim_vals = raw["dimension_values"]
    weights  = raw["weights"]

    dimensions = [
        DimensionScore(
            name=dim_name,
            raw_value=raw_val,
            normalized_score=raw_val,
            weight=weights[dim_name],
            factor_ledger=[
                FactorEntry(
                    name=dim_name,
                    value=raw_val,
                    contribution=round(raw_val * weights[dim_name] * 100.0, 2),
                    source="supplier_metrics",
                )
            ],
        )
        for dim_name, raw_val in dim_vals.items()
    ]

    # Delta vs. 7 days ago
    week_ago = _utcnow() - timedelta(days=7)
    older = [m for m in metrics_history if m.metric_date <= week_ago]
    delta_7d: float | None = None
    if older:
        prev = max(older, key=lambda m: m.metric_date)
        prev_raw = supplier_risk_values(
            on_time_delivery=prev.on_time_delivery,
            quality_ppm=prev.quality_ppm,
            financial_score=prev.financial_score,
            capacity_utilization=prev.capacity_utilization,
            compliance_events=prev.compliance_events,
            spend_share=spend_share,
            weights=custom_weights,
        )
        delta_7d = round(raw["score_0_100"] - prev_raw["score_0_100"], 2)

    # Confidence grows with number of historic data points (capped at 10)
    confidence = _clamp(min(len(metrics_history), 10) / 10.0)

    return SupplierRiskScore(
        supplier_id=supplier_id,
        as_of=_utcnow(),
        score_0_100=raw["score_0_100"],
        dimension_scores=dimensions,
        delta_7d=delta_7d,
        confidence=confidence,
        factor_ledger=[FactorEntry(**entry) for entry in raw["factor_ledger"]],
    )


# ---------------------------------------------------------------------------
# Mitigation comparison
# ---------------------------------------------------------------------------

def compare_mitigations(
    alert: AlertCard,
    graph: "SupplyGraph",
    state: object,
) -> list[MitigationOption]:
    """Generate and rank mitigation options for a live alert.

    Options are ranked by (cost_impact ASC, expected_delay_reduction DESC).
    """
    node = graph.node(alert.subject_id)
    inventory = getattr(state, "inventory", {})
    options: list[MitigationOption] = []

    p50 = alert.p50_days or 14.0
    p95 = alert.p95_days or 21.0

    # --- Reroute via alternate source ---
    alternates = graph.find_alternates(alert.subject_id)
    if alternates:
        alt_id   = alternates[0]
        alt_node = graph.node(alt_id)
        # Alternate route typically 15% longer than primary
        alt_p50 = round(p50 * 1.15, 1)
        alt_p95 = round(alt_p50 * 1.35, 1)
        options.append(MitigationOption(
            type="reroute",
            description=f"Switch to approved alternate: {alt_node.name if alt_node else alt_id}",
            expected_delay_reduction=round(p50 - alt_p50, 1),
            cost_impact=0.15,
            p50_lead_time=alt_p50,
            p95_lead_time=alt_p95,
            assumptions=[
                "Alternate source has available capacity",
                "No concurrent disruption on alternate path",
                "Specifications and quality standards are compatible",
            ],
        ))

    # --- Expedite via air freight / priority carrier ---
    expedite_p50 = round(p50 * 0.72, 1)    # ~28% reduction
    expedite_p95 = round(expedite_p50 * 1.15, 1)
    options.append(MitigationOption(
        type="expedite",
        description="Expedite via air freight or priority carrier",
        expected_delay_reduction=round(p50 - expedite_p50, 1),
        cost_impact=0.40,
        p50_lead_time=expedite_p50,
        p95_lead_time=expedite_p95,
        assumptions=[
            "Air freight capacity available at origin",
            "Commodity is air-freight eligible (size/weight/hazmat)",
            "Procurement and budget approval granted",
        ],
    ))

    # --- Draw on safety stock ---
    inv = inventory.get(alert.subject_id)
    if inv and inv.days_cover > 0:
        net_p50 = round(max(0.0, p50 - inv.days_cover), 1)
        net_p95 = round(max(0.0, p95 - inv.days_cover), 1)
        options.append(MitigationOption(
            type="inventory_reallocation",
            description=f"Draw on safety stock — {inv.days_cover:.1f} days cover available",
            expected_delay_reduction=round(min(inv.days_cover, p50), 1),
            cost_impact=0.05,
            p50_lead_time=net_p50,
            p95_lead_time=net_p95,
            assumptions=[
                "Safety stock is not pre-committed to other orders",
                "Demand forecast remains unchanged during buffer period",
                "Stock can be physically accessed and moved",
            ],
        ))

    # --- Qualify alternate supplier (for supplier-kind disruptions) ---
    if node and node.kind in ("supplier", "supplier_site"):
        alt_sups = [s for s in graph.nodes_by_kind("supplier") if s.id != alert.subject_id]
        if alt_sups:
            alt = alt_sups[0]
            options.append(MitigationOption(
                type="alternate_supplier",
                description=f"Qualify and onboard alternate supplier: {alt.name}",
                expected_delay_reduction=0.0,   # qualification adds time before benefit
                cost_impact=0.20,
                p50_lead_time=round(p50 + 30.0, 1),   # qualification delay
                p95_lead_time=round(p95 + 45.0, 1),
                assumptions=[
                    "Supplier qualification possible within 30 days",
                    "Part specifications compatible with alternate",
                    "Audit and QA resources available",
                ],
                requires_approval=True,
            ))

    # Rank: lowest cost first, then highest delay reduction
    return sorted(options, key=lambda o: (o.cost_impact, -(o.expected_delay_reduction or 0.0)))


# ---------------------------------------------------------------------------
# Stress test
# ---------------------------------------------------------------------------

def run_stress_test(
    request: StressTestRequest,
    graph: "SupplyGraph",
    state: object,
) -> StressTestResult:
    """Forced-failure Monte Carlo stress test.

    Calls math_engine.monte_carlo_exposure(forced_failure=True) with the
    current graph, then generates mitigation options for the impacted nodes.
    """
    node = graph.node(request.target_id)

    # Determine beta params for seed node
    alerts: list[AlertCard] = getattr(state, "alerts", [])
    alert = next((a for a in alerts if a.subject_id == request.target_id), None)

    if alert:
        # Reconstruct from posterior via moment matching
        p   = float(alert.posterior)
        k   = 20.0
        alpha, beta_val = p * k, (1.0 - p) * k
    elif node:
        pr  = prior_for_node(node.kind, node.criticality, 14)
        k   = 6.0
        alpha, beta_val = pr * k, (1.0 - pr) * k
    else:
        alpha, beta_val = 0.5, 9.5   # 5% prior, low certainty

    # Build op-nodes and dependency edges from the live graph
    downstream = graph.downstream_nodes(request.target_id, max_hops=5)
    inventory  = getattr(state, "inventory", {})

    op_nodes: list[OperationalNode] = []
    if node:
        inv = inventory.get(request.target_id)
        op_nodes.append(OperationalNode(
            id=request.target_id, kind=node.kind,
            inventory_days=inv.days_cover if inv else node.inventory_days,
            criticality=node.criticality,
        ))
    for nid, _ in downstream:
        dn  = graph.node(nid)
        if not dn:
            continue
        inv = inventory.get(nid)
        op_nodes.append(OperationalNode(
            id=nid, kind=dn.kind,
            inventory_days=inv.days_cover if inv else dn.inventory_days,
            criticality=dn.criticality,
        ))

    # Gather all edges originating from the seed or its downstream reachable set
    reachable = {request.target_id} | {nid for nid, _ in downstream}
    deps: list[Dependency] = [
        Dependency(
            upstream_id=e.upstream_id,
            downstream_id=e.downstream_id,
            propagation_probability=e.propagation_probability,
            impact_multiplier=e.impact_multiplier,
        )
        for e in graph.all_edges
        if e.upstream_id in reachable
    ]

    mc_results = monte_carlo_exposure(
        seed_id=request.target_id,
        seed_beta=(alpha, beta_val),
        nodes=op_nodes,
        dependencies=deps,
        trials=request.trials,
        rng_seed=request.rng_seed,
        forced_failure=True,
    )

    node_results = [
        StressTestNodeResult(
            node_id=r.node_id,
            node_kind=(graph.node(r.node_id).kind if graph.node(r.node_id) else "unknown"),
            probability_affected=r.probability_affected,
            expected_impact=r.expected_impact,
            p50_stockout_days=r.p50_stockout_days,
            p95_stockout_days=r.p95_stockout_days,
        )
        for r in mc_results
    ]

    # Synthetic worst-case alert to drive mitigation comparison
    synthetic = AlertCard(
        subject_id=request.target_id,
        subject_kind=request.target_kind,
        alert_type="stress_test",
        posterior=1.0,
        prior=prior_for_node(node.kind if node else "supplier", node.criticality if node else 0.5, 14),
        severity=100.0,
        p50_days=14.0,
        p80_days=21.0,
        p95_days=28.0,
        confidence=1.0,
    )
    mitigations = compare_mitigations(synthetic, graph, state)

    return StressTestResult(
        target_id=request.target_id,
        target_kind=request.target_kind,
        trials=request.trials,
        rng_seed=request.rng_seed,
        forced_failure=True,
        node_results=node_results,
        ranked_mitigations=mitigations,
    )


# ---------------------------------------------------------------------------
# Chokepoint Forecasting
# ---------------------------------------------------------------------------

def forecast_chokepoint_stress(
    chokepoint_id: str,
    graph: "SupplyGraph",
    state: object,
    horizon_days: int = 30,
    threshold: float = 0.70
) -> dict:
    """Predicts if a chokepoint's stress value will exceed a threshold over the next N days.
    
    1. Uses structural prior for base risk.
    2. Performs Bayesian update on recent signals.
    3. Runs Kalman state-space model for stress state.
    4. Monte Carlo samples the outcome.
    """
    node = graph.node(chokepoint_id)
    if not node:
        raise ValueError(f"Chokepoint {chokepoint_id} not found in graph.")

    # 1. Priors and Criticality
    prior = prior_for_node(node.kind, node.criticality, horizon_days)
    
    # 2. Bayesian Update with Signals
    now = _utcnow()
    signals = getattr(state, "signals", [])
    relevant_sigs = []
    for sig in signals:
        if any(e.id == chokepoint_id for e in sig.entities):
            relevant_sigs.append(sig)
        elif not sig.entities and sig.lat is not None and sig.lon is not None:
            if node.lat is not None and node.lon is not None:
                # Basic distance heuristic for geographical match
                if abs(sig.lat - node.lat) < 1.0 and abs(sig.lon - node.lon) < 1.0:
                    relevant_sigs.append(sig)

    evidence_list = []
    stress_inputs = []
    for sig in relevant_sigs:
        obs = sig.observed_at
        if obs.tzinfo is None:
            obs = obs.replace(tzinfo=timezone.utc)
        age_days = max(0.0, (now - obs).total_seconds() / 86400.0)

        llr = math.log((sig.intensity + 1e-6) / (1.0 - sig.intensity + 1e-6))
        evidence_list.append(Evidence(
            name=sig.type, llr=llr, weight=sig.credibility,
            source=sig.source, confidence=sig.confidence
        ))
        stress_inputs.append((sig.intensity, sig.confidence, age_days))

    posterior = bayesian_update(chokepoint_id, prior, evidence_list)
    current_stress = node_stress(stress_inputs)

    # 3. Kalman State-Space Model
    kf = KalmanStressModel(mean_stress=current_stress)
    
    # The bayesian posterior probability shifts the expected stress
    shift = (posterior.probability - prior) * node.criticality
    forecast = kf.forecast(horizon_days, bayesian_shift=shift)
    
    # 4. Monte Carlo Distribution
    mc_sim = simulate_stress_forecast(
        mean_stress=forecast["mean_stress"],
        std_stress=forecast["std_stress"],
        threshold=threshold,
        trials=1000
    )
    
    return {
        "chokepoint_id": chokepoint_id,
        "horizon_days": horizon_days,
        "current_stress": round(current_stress, 4),
        "prior_probability": round(prior, 4),
        "posterior_probability": round(posterior.probability, 4),
        "forecasted_mean_stress": forecast["mean_stress"],
        "forecasted_std_stress": forecast["std_stress"],
        "probability_exceeding_threshold": mc_sim["probability_exceeding"],
        "p95_stress_scenario": mc_sim["p95_stress"]
    }

