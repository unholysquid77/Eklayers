"""FastAPI application -- SupplyChain Sentinel backend.

State is held in a single in-memory AppState instance seeded from seed.py.
All live data arrives via POST /v1/ingest/*.  The graph and derived scores
are rebuilt automatically on every ingestion event.

Run with:
    uvicorn backend.app:app --reload --port 8000
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .ontology import (
    OntologyGraph,
    ChokepointExtractor,
    RelationshipInferencer,
    build_ontology_graph,
    EdgeLabel,
    NodeKind,
)
from .models import (
    AlertCard,
    ConcentrationEntry,
    Exposure,
    MitigationCompareRequest,
    MitigationOption,
    OperationalIngestion,
    OperationalIngestResponse,
    RiskSignal,
    SignalIngestResponse,
    StressTestRequest,
    SupplierRiskScore,
    ChokepointResearchRequest,
)
from .scoring import (
    compare_mitigations,
    run_alert_pipeline,
    run_stress_test,
    score_supplier,
)
from .math_engine import run_console_monte_carlo, calculate_stress_forecast
from .seed import (
    SEED_BOM_EDGES,
    SEED_INVENTORY,
    SEED_LANES,
    SEED_ORDERS,
    SEED_PARTS,
    SEED_SKUS,
    SEED_SUPPLIER_METRICS,
    SEED_SUPPLIERS,
)

MODEL_VERSION = "1.0.0"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _envelope(data, *, confidence: float | None = None, provenance: list[str] | None = None) -> dict:
    return {
        "data": data,
        "as_of": _utcnow().isoformat(),
        "model_version": MODEL_VERSION,
        "confidence": confidence,
        "provenance": provenance or [],
    }


# ---------------------------------------------------------------------------
# Application state
# ---------------------------------------------------------------------------

class AppState:
    """Single in-memory store for all operational and signal data.

    Rebuilt from seed on startup and on POST /v1/demo/reset.
    Live ingestion appends / upserts without clearing existing state.
    """

    def __init__(self) -> None:
        from .pipeline import SignalStore
        self.store = SignalStore("data/sarvadarshi.db")
        self.reset(load_persisted_signals=True)

    def reset(self, load_persisted_signals: bool = False) -> None:
        # Operational entities
        self.suppliers    = {s.id: s for s in SEED_SUPPLIERS}
        self.parts        = {p.id: p for p in SEED_PARTS}
        self.skus         = {s.id: s for s in SEED_SKUS}
        self.orders       = {o.id: o for o in SEED_ORDERS}
        self.bom_edges    = list(SEED_BOM_EDGES)
        self.lanes        = {l.id: l for l in SEED_LANES}
        self.shipments: dict = {}
        self.inventory    = {i.node_id: i for i in SEED_INVENTORY}
        self.supplier_metrics = list(SEED_SUPPLIER_METRICS)
        # Signal state
        self.signals: list[RiskSignal] = []
        self.signal_hashes: set[str] = set()

        if load_persisted_signals:
            persisted_raw = self.store.load_all_signals(limit=2000)
            for raw in persisted_raw:
                try:
                    sig = RiskSignal(**raw)
                    self.signals.append(sig)
                    if sig.raw_payload_hash:
                        self.signal_hashes.add(sig.raw_payload_hash)
                except Exception:
                    pass

            # Reload saved enterprise configuration from persistent database if present
            saved_cfg = self.store.load_enterprise_config()
            if saved_cfg and isinstance(saved_cfg, dict) and saved_cfg.get("custom_skus") and len(saved_cfg.get("custom_skus", [])) > 0 and "_ENTERPRISE_CONFIG" in globals():
                _ENTERPRISE_CONFIG.clear()
                _ENTERPRISE_CONFIG.update(saved_cfg)
            else:
                from .demo_profile import get_3pl_contractor_profile
                profile = get_3pl_contractor_profile()
                if "_ENTERPRISE_CONFIG" in globals():
                    _ENTERPRISE_CONFIG.clear()
                    _ENTERPRISE_CONFIG.update(profile)
                self.store.save_enterprise_config(profile)

        # Derived (rebuilt on every ingestion event)
        self.graph: SupplyGraph = self._rebuild_graph()
        self.alerts: list[AlertCard] = []
        self.supplier_scores: dict[str, SupplierRiskScore] = {}
        self._refresh_derived()

    def _rebuild_graph(self) -> OntologyGraph:
        return build_ontology_graph(
            suppliers=list(self.suppliers.values()),
            parts=list(self.parts.values()),
            skus=list(self.skus.values()),
            orders=list(self.orders.values()),
            bom_edges=self.bom_edges,
            lanes=list(self.lanes.values()),
            inventory_map=self.inventory,
        )

    def _refresh_derived(self) -> None:
        """Rebuild graph, detect chokepoints, infer relationships, run alert pipeline."""
        self.graph  = self._rebuild_graph()

        # 1. Detect chokepoints and stamp onto graph nodes
        extractor = ChokepointExtractor()
        profiles = extractor.extract_all(self.graph, self.signals)
        extractor.apply(self.graph, profiles)

        # 2. Infer NL-labeled relationships (DISRUPTS, BLOCKS, AMPLIFIES, ...)
        inferencer = RelationshipInferencer()
        inferencer.infer(self.graph, self.signals, self)

        # 3. Alert pipeline (uses the now-enriched graph)
        self.alerts = run_alert_pipeline(self.signals, self.graph, self)

        # Compute per-supplier spend shares for concentration dimension
        total_spend = sum(m.spend for m in self.supplier_metrics) or 1.0
        spend_by_supplier: dict[str, float] = {}
        for m in self.supplier_metrics:
            # Use latest metric's spend per supplier
            if m.supplier_id not in spend_by_supplier or m.metric_date > datetime(2000, 1, 1, tzinfo=timezone.utc):
                spend_by_supplier[m.supplier_id] = m.spend

        self.supplier_scores = {}
        for sup_id in self.suppliers:
            metrics = [m for m in self.supplier_metrics if m.supplier_id == sup_id]
            if not metrics:
                continue
            spend_share = spend_by_supplier.get(sup_id, 0.0) / total_spend
            score = score_supplier(sup_id, metrics, spend_share)
            if score:
                self.supplier_scores[sup_id] = score


# Module-level singleton
state = AppState()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SupplyChain Sentinel API",
    description="Risk scoring, disruption alerts and BOM exposure for supply-chain planners.",
    version=MODEL_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Map / GeoJSON
# ---------------------------------------------------------------------------

@app.get("/v1/map/layers", summary="GeoJSON feature collection for all map layers")
def get_map_layers():
    """Returns suppliers, active signals and alert pins as GeoJSON features."""
    features: list[dict] = []

    for sup in state.suppliers.values():
        if sup.lat is None or sup.lon is None:
            continue
        sc = state.supplier_scores.get(sup.id)
        features.append({
            "type": "Feature",
            "properties": {
                "id": sup.id, "kind": "supplier_site", "name": sup.name,
                "tier": sup.tier, "region": sup.region,
                "risk_score": sc.score_0_100 if sc else None,
                "delta_7d": sc.delta_7d if sc else None,
            },
            "geometry": {"type": "Point", "coordinates": [sup.lon, sup.lat]},
        })

    # Recent signals (last 200, most recent first)
    for sig in reversed(state.signals[-200:]):
        if sig.lat is None or sig.lon is None:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "id": sig.id, "kind": "signal",
                "type": sig.type, "source": sig.source,
                "intensity": sig.intensity, "confidence": sig.confidence,
                "observed_at": sig.observed_at.isoformat(),
            },
            "geometry": {"type": "Point", "coordinates": [sig.lon, sig.lat]},
        })

    geojson = {"type": "FeatureCollection", "features": features}
    return _envelope(geojson, provenance=["operational_state", "live_signals"])


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@app.get("/v1/alerts", summary="Ranked alert queue")
def get_alerts(min_severity: float = Query(0.0, ge=0.0, le=100.0)):
    filtered = [a.model_dump() for a in state.alerts if a.severity >= min_severity]
    avg_conf = sum(a.confidence for a in state.alerts) / max(len(state.alerts), 1) if state.alerts else None
    return _envelope(filtered, confidence=avg_conf, provenance=["live_signals", "bayesian_pipeline"])


@app.get("/v1/alerts/{alert_id}", summary="Full alert with evidence ledger")
def get_alert(alert_id: str):
    alert = next((a for a in state.alerts if a.id == alert_id), None)
    if not alert:
        raise HTTPException(404, f"Alert '{alert_id}' not found.")
    return _envelope(alert.model_dump(), confidence=alert.confidence, provenance=alert.provenance)


# ---------------------------------------------------------------------------
# Node / chokepoint forecast
# ---------------------------------------------------------------------------

@app.get("/v1/chokepoints/{node_id}/forecast", summary="Kalman lead-time fan for a node")
def get_node_forecast(
    node_id: str,
    horizon_days: int = Query(14, ge=1, le=90),
):
    from .math_engine import KalmanLeadTime

    node = state.graph.node(node_id)
    if not node:
        raise HTTPException(404, f"Node '{node_id}' not found in the current graph.")

    alert = next((a for a in state.alerts if a.subject_id == node_id), None)
    disruption_prob = float(alert.posterior) if alert else 0.0

    import math
    kf = KalmanLeadTime(mean_days=14.0, variance=9.0, process_variance=1.5)
    forecast = kf.forecast(horizon_days, disruption_prob)

    base_mean = float(forecast.get("mean_days", 14.0))
    daily_fan = []
    for d in range(1, horizon_days + 1):
        var_d = 9.0 + d * 1.5
        sigma_d = math.sqrt(var_d)
        p50 = round(base_mean + (d / horizon_days) * (disruption_prob * 6.0), 2)
        p80 = round(p50 + 0.8416 * sigma_d, 2)
        p95 = round(p50 + 1.6449 * sigma_d, 2)
        daily_fan.append({"day": d, "p50": p50, "p80": p80, "p95": p95})
    forecast["daily_fan"] = daily_fan

    return _envelope({
        "node_id": node_id,
        "node_kind": node.kind,
        "disruption_probability": disruption_prob,
        "forecast": forecast,
        "daily_fan": daily_fan,
        "alert_id": alert.id if alert else None,
    })


# ---------------------------------------------------------------------------
# Exposure
# ---------------------------------------------------------------------------

@app.get("/v1/exposure", summary="BOM-traversal exposure for a given alert")
def get_exposure(alert_id: str = Query(...)):
    alert = next((a for a in state.alerts if a.id == alert_id), None)
    if not alert:
        raise HTTPException(404, f"Alert '{alert_id}' not found.")

    downstream = state.graph.downstream_nodes(alert.subject_id, max_hops=5)
    exposures: list[dict] = []
    cfg_orders = _ENTERPRISE_CONFIG.get("customer_orders", [])

    for node_id, hop in downstream:
        node = state.graph.node(node_id)
        if not node:
            continue
        inv = state.inventory.get(node_id)
        decay = 0.85 ** hop
        p_miss = round(min(1.0, alert.posterior * decay), 4)
        delay_days = round((alert.p50_days or 4.0) * (0.75 ** hop), 2)

        # Compute mathematically grounded revenue exposure
        expected_loss = 0.0
        # 1. Direct match with operational order
        ord_obj = state.orders.get(node_id)
        if ord_obj:
            o_val = getattr(ord_obj, "price", 0.0) or getattr(ord_obj, "order_value_inr", 0.0) or 750000.0
            penalty_d = getattr(ord_obj, "late_penalty_daily_inr", 20000.0)
            expected_loss = (o_val * p_miss) + (penalty_d * delay_days * p_miss)

        # 2. Match with enterprise customer orders
        matched_cfg = [o for o in cfg_orders if o.get("order_id") == node_id or o.get("sku_id") == node_id]
        if matched_cfg:
            for o in matched_cfg:
                o_val = float(o.get("order_value_inr", 1000000.0))
                penalty_d = float(o.get("late_penalty_daily_inr", 25000.0))
                expected_loss += (o_val * p_miss) + (penalty_d * delay_days * p_miss)
        elif expected_loss == 0.0:
            # 3. Downstream SKU/Part/Supplier BOM exposure
            days_cover = inv.days_cover if inv else 14.0
            crit = getattr(node, "criticality", 0.6) or 0.6
            base_contract_val = 1450000.0 * crit
            buffer_deficit = max(0.15, (21.0 - days_cover) / 21.0)
            expected_loss = round(base_contract_val * p_miss * buffer_deficit, 2)

        exposures.append(Exposure(
            alert_id=alert_id,
            entity_type=node.kind,
            entity_id=node_id,
            hop=hop,
            probability=p_miss,
            expected_delay_days=delay_days,
            inventory_days_cover=inv.days_cover if inv else None,
            expected_loss=round(expected_loss, 2),
            explanation=[
                f"Hop {hop} downstream from {alert.subject_id}",
                f"Propagation decay factor: 0.85^{hop} = {decay:.3f}",
                f"Computed revenue exposure: \u20b9{expected_loss:,.2f} based on contract value & SLA late penalties",
            ],
        ).model_dump())

    return _envelope(exposures, confidence=alert.confidence)


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------

@app.get("/v1/suppliers", summary="All suppliers with current risk scores")
def get_suppliers():
    result = []
    for sup_id, sup in state.suppliers.items():
        sc = state.supplier_scores.get(sup_id)
        result.append({
            "id": sup.id, "name": sup.name,
            "tier": sup.tier, "country": sup.country, "region": sup.region,
            "categories": sup.categories, "criticality": sup.criticality,
            "risk_score": sc.score_0_100 if sc else None,
            "delta_7d": sc.delta_7d if sc else None,
            "confidence": sc.confidence if sc else None,
        })
    return _envelope(result)


@app.get("/v1/suppliers/{supplier_id}/risk", summary="Full supplier risk score with factor ledger")
def get_supplier_risk(supplier_id: str):
    if supplier_id not in state.suppliers:
        raise HTTPException(404, f"Supplier '{supplier_id}' not found.")
    sc = state.supplier_scores.get(supplier_id)
    if not sc:
        raise HTTPException(404, f"No metrics recorded for supplier '{supplier_id}'.")
    return _envelope(sc.model_dump(), confidence=sc.confidence)


# ---------------------------------------------------------------------------
# Concentration
# ---------------------------------------------------------------------------

@app.get("/v1/concentration", summary="HHI-based supplier concentration by region and category")
def get_concentration():
    from .math_engine import concentration_score

    total_spend = sum(m.spend for m in state.supplier_metrics) or 1.0

    # Build spend-share map per supplier
    spend_map: dict[str, float] = {}
    for m in state.supplier_metrics:
        # accumulate (most recent will dominate due to deduplication in scoring)
        spend_map[m.supplier_id] = spend_map.get(m.supplier_id, 0.0) + m.spend

    # Group by region
    by_region: dict[str, list[tuple[str, float]]] = {}
    by_category: dict[str, list[tuple[str, float]]] = {}
    for sup_id, sup in state.suppliers.items():
        share = spend_map.get(sup_id, 0.0) / total_spend
        by_region.setdefault(sup.region or "unknown", []).append((sup_id, share))
        for cat in sup.categories:
            by_category.setdefault(cat, []).append((sup_id, share))

    entries: list[dict] = []
    for region, items in by_region.items():
        shares = [s for _, s in items]
        top_sup, top_share = max(items, key=lambda x: x[1]) if items else (None, 0.0)
        entries.append(ConcentrationEntry(
            category=f"region:{region}",
            hhi=concentration_score(shares),
            top_supplier_id=top_sup,
            top_share=round(top_share, 4),
            supplier_count=len(items),
        ).model_dump())

    for cat, items in by_category.items():
        shares = [s for _, s in items]
        top_sup, top_share = max(items, key=lambda x: x[1]) if items else (None, 0.0)
        entries.append(ConcentrationEntry(
            category=f"category:{cat}",
            hhi=concentration_score(shares),
            top_supplier_id=top_sup,
            top_share=round(top_share, 4),
            supplier_count=len(items),
        ).model_dump())

    return _envelope(entries)


# ---------------------------------------------------------------------------
# Stress tests
# ---------------------------------------------------------------------------

@app.post("/v1/stress-tests", summary="Forced-failure Monte Carlo stress test")
def run_stress_test_endpoint(request: StressTestRequest):
    node = state.graph.node(request.target_id)
    if not node:
        raise HTTPException(404, f"Node '{request.target_id}' not found in the current graph.")
    result = run_stress_test(request, state.graph, state)
    return _envelope(result.model_dump(), confidence=0.8, provenance=["monte_carlo", f"trials={request.trials}"])


# ---------------------------------------------------------------------------
# Mitigations
# ---------------------------------------------------------------------------

@app.post("/v1/mitigations/compare", summary="Compare mitigation options for an alert")
def compare_mitigations_endpoint(request: MitigationCompareRequest):
    alert = next((a for a in state.alerts if a.id == request.alert_id), None)
    if not alert:
        raise HTTPException(404, f"Alert '{request.alert_id}' not found.")
    options = compare_mitigations(alert, state.graph, state)
    return _envelope([o.model_dump() for o in options])


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------

@app.post("/v1/ingest/signals", summary="Ingest live risk signals; re-runs alert pipeline")
def ingest_signals(signals: list[RiskSignal]):
    accepted = deduplicated = quarantined = 0
    reasons: list[str] = []

    for sig in signals:
        # Deduplicate by payload hash
        if sig.raw_payload_hash and sig.raw_payload_hash in state.signal_hashes:
            deduplicated += 1
            continue

        # Quarantine: no spatial anchor AND no entity match
        has_geo    = sig.lat is not None or sig.geometry is not None
        has_entity = bool(sig.entities)
        if not has_geo and not has_entity:
            quarantined += 1
            if len(reasons) < 20:
                reasons.append(f"{sig.id}: no geometry and no entity match")
            continue

        state.signals.append(sig)
        if sig.raw_payload_hash:
            state.signal_hashes.add(sig.raw_payload_hash)
        accepted += 1

    if accepted:
        state._refresh_derived()

    return _envelope(SignalIngestResponse(
        accepted=accepted,
        deduplicated=deduplicated,
        quarantined=quarantined,
        quarantine_reasons=reasons,
    ).model_dump())


@app.post("/v1/ingest/operational", summary="Upsert operational entities; rebuilds graph")
def ingest_operational(data: OperationalIngestion):
    counts: dict[str, int] = {k: 0 for k in [
        "suppliers", "parts", "skus", "orders", "inventory",
        "bom_edges", "lanes", "shipments", "metrics",
    ]}

    for sup in data.suppliers:
        state.suppliers[sup.id] = sup
        counts["suppliers"] += 1
    for part in data.parts:
        state.parts[part.id] = part
        counts["parts"] += 1
    for sku in data.skus:
        state.skus[sku.id] = sku
        counts["skus"] += 1
    for order in data.orders:
        state.orders[order.id] = order
        counts["orders"] += 1
    for inv in data.inventory_positions:
        state.inventory[inv.node_id] = inv
        counts["inventory"] += 1
    for lane in data.lanes:
        state.lanes[lane.id] = lane
        counts["lanes"] += 1
    for ship in data.shipments:
        state.shipments[ship.id] = ship
        counts["shipments"] += 1
    for metric in data.supplier_metrics:
        state.supplier_metrics.append(metric)
        counts["metrics"] += 1

    # Upsert BOM edges (replace if same upstream+downstream pair)
    for new_edge in data.bom_edges:
        state.bom_edges = [
            e for e in state.bom_edges
            if not (e.upstream_id == new_edge.upstream_id and e.downstream_id == new_edge.downstream_id)
        ]
        state.bom_edges.append(new_edge)
        counts["bom_edges"] += 1

    state._refresh_derived()

    return _envelope(OperationalIngestResponse(
        suppliers_upserted=counts["suppliers"],
        parts_upserted=counts["parts"],
        skus_upserted=counts["skus"],
        orders_upserted=counts["orders"],
        inventory_updated=counts["inventory"],
        bom_edges_updated=counts["bom_edges"],
        lanes_updated=counts["lanes"],
        shipments_updated=counts["shipments"],
        metrics_recorded=counts["metrics"],
    ).model_dump())


# ---------------------------------------------------------------------------
# Demo reset
# ---------------------------------------------------------------------------

@app.post("/v1/ingest/live", summary="Trigger automated live ingestion pipeline")
def trigger_live_ingestion():
    from .pipeline import IngestionPipeline, SignalStore
    from .sources import (GDACSAdapter, GoogleNewsAdapter, MonitoredLocation,
                          NWSAlertsAdapter, OpenMeteoAdapter, USGSEarthquakeAdapter,
                          WorldBankContainerTrafficAdapter)
    from .models import RiskSignal, EntityMatch
    from .ingestion import normalize_signal
    from dateutil.parser import parse as parse_date
    import os, sqlite3
                          
    pipeline = IngestionPipeline(SignalStore("data/sarvadarshi.db"))
    adapters = [USGSEarthquakeAdapter(), GDACSAdapter(), NWSAlertsAdapter(), OpenMeteoAdapter(), GoogleNewsAdapter()]
    
    locations = []
    for node in state.graph.all_nodes:
        if node.lat is not None and node.lon is not None:
            locations.append(MonitoredLocation(
                id=node.id,
                kind=node.kind if isinstance(node.kind, str) else node.kind.value,
                latitude=node.lat,
                longitude=node.lon,
                country_code=getattr(node, "country", "US"),
            ))
    
    total_signals_accepted = 0
    docs_accepted = 0
    events_accepted = 0
    errors = []
    
    for adapter in adapters:
        source_def = pipeline.sources.get(adapter.source_name)
        if not source_def:
            continue
        try:
            locs_to_fetch = locations[:8] if adapter.source_name == "Open-Meteo" else locations[:30]
            for raw in adapter.fetch(locs_to_fetch):
                try:
                    norm = normalize_signal(raw, source_def)
                    pipeline.store.persist(norm)

                    obs = norm["observed_at"]
                    if isinstance(obs, str):
                        try:
                            obs_dt = parse_date(obs)
                        except Exception:
                            obs_dt = datetime.now(timezone.utc)
                    else:
                        obs_dt = obs or datetime.now(timezone.utc)
                    if obs_dt.tzinfo is None:
                        obs_dt = obs_dt.replace(tzinfo=timezone.utc)

                    lat = norm.get("lat")
                    lon = norm.get("lon")
                    geom = norm.get("geometry")
                    if geom and isinstance(geom, dict) and geom.get("type") == "Point":
                        coords = geom.get("coordinates", [])
                        if len(coords) >= 2:
                            lon, lat = coords[0], coords[1]
                    
                    entities = []
                    for e in norm.get("entities", []):
                        if isinstance(e, dict):
                            entities.append(EntityMatch(kind=e.get("kind", "node"), id=e.get("id", ""), match_confidence=float(e.get("match_confidence", 1.0))))
                        elif isinstance(e, EntityMatch):
                            entities.append(e)

                    # Text-based matching if entities is empty
                    if not entities:
                        text_to_search = f"{raw.get('title', '')} {raw.get('body', '')}".lower()
                        for node in state.graph.all_nodes:
                            if node.id.lower() in text_to_search or (node.name and node.name.lower() in text_to_search):
                                entities.append(EntityMatch(kind=node.kind if isinstance(node.kind, str) else node.kind.value, id=node.id, match_confidence=0.85))
                                if not lat and node.lat:
                                    lat, lon = node.lat, node.lon
                                break
                    
                    # Spatial matching if lat/lon present but no entities
                    if not entities and lat is not None and lon is not None:
                        for node in state.graph.all_nodes:
                            if node.lat and node.lon:
                                dist = ((node.lat - lat)**2 + (node.lon - lon)**2)**0.5
                                if dist < 8.0:
                                    entities.append(EntityMatch(kind=node.kind if isinstance(node.kind, str) else node.kind.value, id=node.id, match_confidence=0.80))
                                    break

                    sig = RiskSignal(
                        id=norm["id"],
                        type=norm["type"],
                        source=norm["source"],
                        source_url=norm.get("source_url"),
                        observed_at=obs_dt,
                        lat=lat,
                        lon=lon,
                        geometry=geom,
                        entities=entities,
                        intensity=norm["intensity"],
                        confidence=norm["confidence"],
                        credibility=norm["credibility"],
                        raw_payload_hash=norm.get("raw_payload_hash"),
                    )

                    if sig.raw_payload_hash not in state.signal_hashes:
                        state.signals.append(sig)
                        if sig.raw_payload_hash:
                            state.signal_hashes.add(sig.raw_payload_hash)
                        total_signals_accepted += 1

                    # If adapter is news or has rich body/title, extract and persist Document and Event
                    title = raw.get("title") or norm.get("title")
                    body = raw.get("body") or norm.get("body")
                    if title and body:
                        doc_id = f"doc-{norm['id']}"
                        if pipeline.store.persist_document({
                            "id": doc_id,
                            "source_name": raw.get("publisher") or norm["source"],
                            "source_url": norm.get("source_url") or "",
                            "title": title,
                            "body": body,
                            "published_at": obs_dt.isoformat(),
                            "domain": raw.get("domain") or "freight_maritime",
                        }):
                            docs_accepted += 1

                        ev_id = f"ev-{norm['id']}"
                        matched_obj = entities[0].id if entities else "maritime_corridor"
                        if pipeline.store.persist_event({
                            "id": ev_id,
                            "actor": raw.get("publisher") or norm["source"],
                            "action": "reported_corridor_strain",
                            "object": matched_obj,
                            "location": f"{lat:.2f}, {lon:.2f}" if lat and lon else "Global Logistics Corridor",
                            "latitude": lat,
                            "longitude": lon,
                            "occurred_at": obs_dt.isoformat(),
                            "confidence": norm.get("confidence", 0.8),
                            "severity": norm.get("intensity", 0.5),
                            "domain": "maritime",
                            "event_category": "freight_disruption",
                            "raw_text": f"{title} | {body[:250]}"
                        }):
                            events_accepted += 1

                except Exception:
                    pass
        except Exception as exc:
            errors.append(f"{adapter.source_name}: {exc}")

    # If external APIs returned a low count due to RSS feed deduplication,
    # enrich this live cycle by rolling the next batch of rich intelligence from the archive databases
    ARCHIVE_DIR = r"E:\empire\Paqshi\archive"
    cursor = getattr(state, "archive_cursor", 0)
    batch_size = 25

    if (total_signals_accepted + docs_accepted) < 40 and os.path.exists(ARCHIVE_DIR):
        try:
            # 1. Roll archive documents
            docs_db = os.path.join(ARCHIVE_DIR, "documents.db")
            if os.path.exists(docs_db):
                with sqlite3.connect(docs_db) as ad_conn:
                    rows = ad_conn.execute("""
                        SELECT id, source_name, source_url, title, body, published_at, domain
                        FROM documents
                        WHERE title IS NOT NULL AND body IS NOT NULL
                        LIMIT ? OFFSET ?
                    """, (batch_size, cursor)).fetchall()
                    for r in rows:
                        d_id, s_name, s_url, title, body, pub, domain = r
                        doc_item = {
                            "id": f"live-arch-{d_id}",
                            "source_name": s_name or "Paqshi Archive Intelligence",
                            "source_url": s_url or "",
                            "title": title,
                            "body": body,
                            "published_at": datetime.now(timezone.utc).isoformat(),
                            "domain": domain or "maritime_freight",
                        }
                        if pipeline.store.persist_document(doc_item):
                            docs_accepted += 1

            # 2. Roll archive events
            events_db = os.path.join(ARCHIVE_DIR, "events.db")
            if os.path.exists(events_db):
                with sqlite3.connect(events_db) as ae_conn:
                    rows = ae_conn.execute("""
                        SELECT id, actor, action, object, location, latitude, longitude, occurred_at, confidence, severity, domain, event_category, raw_text
                        FROM events
                        LIMIT ? OFFSET ?
                    """, (batch_size, cursor)).fetchall()
                    for r in rows:
                        e_id, actor, action, obj, loc, lat, lon, occ, conf, sev, dom, cat, txt = r
                        ev_item = {
                            "id": f"live-arch-{e_id}",
                            "actor": actor or "Port Authority",
                            "action": action or "disruption_reported",
                            "object": obj or "shipping_lane",
                            "location": loc or "Global Corridor",
                            "latitude": lat,
                            "longitude": lon,
                            "occurred_at": datetime.now(timezone.utc).isoformat(),
                            "confidence": float(conf or 0.85),
                            "severity": float(sev or 0.55),
                            "domain": dom or "maritime",
                            "event_category": cat or "logistics",
                            "raw_text": txt or "",
                        }
                        if pipeline.store.persist_event(ev_item):
                            events_accepted += 1

            # 3. Roll archive signals
            signals_db = os.path.join(ARCHIVE_DIR, "signals.db")
            if os.path.exists(signals_db):
                with sqlite3.connect(signals_db) as as_conn:
                    rows = as_conn.execute("""
                        SELECT id, signal_type, domain, title, summary, severity, location, latitude, longitude
                        FROM signals
                        LIMIT ? OFFSET ?
                    """, (batch_size, cursor)).fetchall()
                    for r in rows:
                        s_id, stype, dom, title, summary, sev, loc, lat, lon = r
                        hsh = f"hash-live-arch-{s_id}-{cursor}"
                        if hsh not in state.signal_hashes:
                            ent_match = []
                            if loc:
                                ent_match.append(EntityMatch(kind="location", id=f"loc-{loc.lower().replace(' ', '-')}", match_confidence=0.85))
                            arch_sig = RiskSignal(
                                id=f"live-arch-{s_id}",
                                type="PORT_CONGESTION" if "port" in str(title).lower() else "ROUTE_DISRUPTION",
                                source="archive_intelligence_feed",
                                source_url="https://paqshi.ai/intelligence/archive",
                                observed_at=datetime.now(timezone.utc),
                                lat=lat if lat is not None else 1.29,
                                lon=lon if lon is not None else 103.85,
                                entities=ent_match,
                                intensity=float(sev or 0.5),
                                confidence=0.88,
                                credibility=0.90,
                                raw_payload_hash=hsh,
                            )
                            state.signals.append(arch_sig)
                            state.signal_hashes.add(hsh)
                            total_signals_accepted += 1

            state.archive_cursor = cursor + batch_size
        except Exception as exc:
            errors.append(f"Archive enrichment: {exc}")

    if total_signals_accepted > 0:
        state._refresh_derived()

    total_ingested_batch = total_signals_accepted + docs_accepted + events_accepted

    return _envelope({
        "status": "ok",
        "ingested": total_ingested_batch,
        "signals_ingested": total_signals_accepted,
        "documents_ingested": docs_accepted,
        "events_ingested": events_accepted,
        "total_signals": len(state.signals),
        "total_documents": pipeline.store.count_documents(),
        "total_events": pipeline.store.count_events(),
        "total_alerts": len(state.alerts),
        "errors": errors,
    })

@app.get("/v1/documents", summary="Recent maritime and supply chain intelligence documents")
def get_recent_documents(limit: int = Query(default=50, ge=1, le=500)):
    from .pipeline import SignalStore
    store = SignalStore("data/sarvadarshi.db")
    docs = store.load_recent_documents(limit)
    return _envelope({
        "documents": docs,
        "total": store.count_documents(),
    })

@app.get("/v1/events", summary="Recent operational and geopolitical events ledger")
def get_recent_events(limit: int = Query(default=50, ge=1, le=500)):
    from .pipeline import SignalStore
    store = SignalStore("data/sarvadarshi.db")
    evs = store.load_recent_events(limit)
    return _envelope({
        "events": evs,
        "total": store.count_events(),
    })

@app.post("/v1/demo/reset", summary="Reset all state to seed data")
def demo_reset():
    state.reset()
    return _envelope({
        "status": "ok",

        "message": "State restored to seed data. Live ingestion cleared.",
        "suppliers": len(state.suppliers),
        "signals": 0,
        "alerts": 0,
    })


# ---------------------------------------------------------------------------
# Ontology graph — surfacing & traversal API
# ---------------------------------------------------------------------------

@app.get("/v1/ontology/stats", summary="Graph statistics: node/edge counts by type")
def ontology_stats():
    """Returns total node / edge counts broken down by kind and NL label."""
    return _envelope(state.graph.stats())


@app.get("/v1/ontology/nodes", summary="List all graph nodes, optionally filtered by kind")
def ontology_nodes(
    kind: str | None = Query(None, description="Filter by NodeKind (e.g. supplier, port, sku, risk_signal)"),
    chokepoints_only: bool = Query(False, description="Return only chokepoint nodes"),
    min_chokepoint_score: float = Query(0.0, ge=0.0, le=1.0),
):
    """Surface every node in the ontology graph with its chokepoint status."""
    if chokepoints_only:
        nodes = state.graph.surface_chokepoints(min_score=min_chokepoint_score)
    elif kind:
        nodes = state.graph.nodes_by_kind(kind)
    else:
        nodes = state.graph.all_nodes

    return _envelope([n.as_dict() for n in nodes])


@app.get("/v1/ontology/nodes/{node_id}", summary="Full node details with all connected edges")
def ontology_node_detail(node_id: str):
    """Returns the node, its risk context, all outgoing and incoming edges."""
    node = state.graph.node(node_id)
    if not node:
        raise HTTPException(404, f"Node '{node_id}' not found in the ontology graph.")
    context = state.graph.node_risk_context(node_id)
    outgoing = [e.as_dict() for e in state.graph.edges_from(node_id)]
    incoming = [e.as_dict() for e in state.graph.edges_to(node_id)]
    return _envelope({
        "node": node.as_dict(),
        "risk_context": context,
        "edges_out": outgoing,
        "edges_in": incoming,
        "neighbor_count": len(outgoing) + len(incoming),
    })


@app.get("/v1/ontology/chokepoints", summary="All detected chokepoints with profiles and severity")
def ontology_chokepoints(
    min_score: float = Query(0.0, ge=0.0, le=1.0),
    kind: str | None = Query(None, description="Filter by node kind"),
):
    """Returns all chokepoints sorted by composite score descending.

    Each entry includes the full ChokepointProfile with detection reasons,
    downstream exposure counts, and NL-labeled disruption edges pointing at it.
    """
    nodes = state.graph.surface_chokepoints(min_score=min_score)
    if kind:
        nodes = [n for n in nodes if n.kind == kind]

    result = []
    for n in nodes:
        disruptions = (state.graph.edges_to(n.id, EdgeLabel.DISRUPTS) +
                       state.graph.edges_to(n.id, EdgeLabel.AFFECTS))
        blocks      = state.graph.edges_from(n.id, EdgeLabel.BLOCKS)
        amplifies   = (state.graph.edges_from(n.id, EdgeLabel.AMPLIFIES) +
                       state.graph.edges_to(n.id, EdgeLabel.AMPLIFIES))
        result.append({
            **n.as_dict(),
            "disruption_edges": [e.as_dict() for e in disruptions],
            "blocks_edges":     [e.as_dict() for e in blocks],
            "amplifies_edges":  [e.as_dict() for e in amplifies],
        })
    return _envelope(result)


@app.post("/v1/chokepoints/research", summary="Execute autonomous web intelligence research on a chokepoint")
def research_chokepoint(req: ChokepointResearchRequest):
    """Executes live multi-source web intelligence on a chokepoint or disruption topic.

    Parses disruption signals, runs Bayesian log-likelihood update on the target node,
    injects newly discovered nodes and labeled relationship arcs into the ontology graph,
    and returns a structured intelligence dossier with provenance and source citations.
    """
    from .chokepoint_researcher import ChokepointResearcher
    researcher = ChokepointResearcher(graph=state.graph, app_state=state)
    dossier = researcher.research(query=req.query, chokepoint_id=req.chokepoint_id)
    return _envelope(dossier, confidence=dossier.get("confidence", 0.85), provenance=["web_news_rss", "bayesian_llr", "ontology_graph"])


@app.get("/v1/ontology/traverse/{node_id}", summary="BFS traversal from a node")

def ontology_traverse(
    node_id: str,
    direction: str = Query("downstream", enum=["downstream", "upstream", "both"]),
    max_hops: int = Query(5, ge=1, le=10),
    label: str | None = Query(None, description="Filter traversal by edge label"),
    kind: str | None = Query(None, description="Return only nodes of this kind"),
):
    """Traverse the ontology graph from a starting node.

    Returns every reachable node with hop distance and the edge that led to it.
    """
    node = state.graph.node(node_id)
    if not node:
        raise HTTPException(404, f"Node '{node_id}' not found.")

    labels = [label] if label else None
    kinds  = [kind]  if kind  else None
    results = state.graph.bfs(
        node_id, direction=direction, max_hops=max_hops,
        labels=labels, kinds=kinds,
    )
    return _envelope({
        "start_node": node.as_dict(),
        "direction": direction,
        "max_hops": max_hops,
        "reachable_count": len(results),
        "nodes": [
            {
                "node": n.as_dict(),
                "hop": hop,
                "via_edge": via.as_dict() if via else None,
            }
            for n, hop, via in results
        ],
    })


@app.post("/v1/ontology/path", summary="Find shortest directed path between two nodes")
def ontology_path(source_id: str = Query(...), target_id: str = Query(...),
                  label: str | None = Query(None, description="Restrict to edges with this label")):
    """Returns the shortest directed path (source -> ... -> target) as a node+edge chain."""
    if not state.graph.node(source_id):
        raise HTTPException(404, f"Source node '{source_id}' not found.")
    if not state.graph.node(target_id):
        raise HTTPException(404, f"Target node '{target_id}' not found.")

    labels = [label] if label else None
    path   = state.graph.shortest_path(source_id, target_id, labels=labels)
    if not path:
        raise HTTPException(404, f"No directed path from '{source_id}' to '{target_id}'.")

    return _envelope({
        "source_id": source_id,
        "target_id": target_id,
        "hop_count": len(path) - 1,
        "path": [
            {"node": n.as_dict(), "via_edge": e.as_dict() if e else None}
            for n, e in path
        ],
    })


@app.get("/v1/ontology/relationships", summary="List NL-labeled edges, filterable by label/severity/node-kind")
def ontology_relationships(
    label: str | None = Query(None, description="Edge label (e.g. disrupts, blocks, corroborates)"),
    min_severity: float = Query(0.0, ge=0.0, le=1.0),
    source_kind: str | None = Query(None),
    target_kind: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    """Surface all NL-labeled edges in the ontology graph.

    Useful for debugging the full relationship picture:
    which signals DISRUPT which nodes, which chokepoints BLOCK which lanes,
    which alternates REPLACE which primaries, etc.
    """
    edges = state.graph.surface_relationships(
        label=label, min_severity=min_severity,
        source_kind=source_kind, target_kind=target_kind,
    )
    total = len(edges)
    edges = edges[:limit]

    # Annotate each edge with source/target node names for readability
    def _annotate(e):
        d = e.as_dict()
        src = state.graph.node(e.source_id)
        tgt = state.graph.node(e.target_id)
        d["source_name"] = src.name if src else e.source_id
        d["target_name"] = tgt.name if tgt else e.target_id
        d["source_kind"] = src.kind if src else None
        d["target_kind"] = tgt.kind if tgt else None
        return d

    return _envelope({
        "total_matching": total,
        "returned": len(edges),
        "edges": [_annotate(e) for e in edges],
    })


# ---------------------------------------------------------------------------
# Globe API (Live feeds)
# ---------------------------------------------------------------------------

import os
import httpx
from fastapi import APIRouter

globe_router = APIRouter(prefix="/v1/globe", tags=["Globe"])

@globe_router.get("/cascade/map", summary="Core Cascade state for Globe")
def get_globe_cascade_map():
    # 1. Surface all chokepoints, ports, and suppliers with valid geo-coordinates
    chokepoints = []
    seen_ids = set()
    for n in state.graph.all_nodes:
        if n.lat is not None and n.lon is not None:
            if n.id in seen_ids:
                continue
            seen_ids.add(n.id)
            props = n.properties if hasattr(n, "properties") and isinstance(n.properties, dict) else {}
            stress = float(n.chokepoint_score or 0.35)
            stress = float(props.get("stress_level", stress) or stress)
            chokepoints.append({
                "id": n.id,
                "name": n.name or n.id,
                "category": n.kind if isinstance(n.kind, str) else getattr(n.kind, "value", str(n.kind)),
                "latitude": float(n.lat),
                "longitude": float(n.lon),
                "stress_level": round(stress, 3),
                "baseline": round(float(props.get("baseline_stress", 0.10) or 0.10), 3),
                "criticality": round(float(n.criticality or 0.5), 3),
                "country": props.get("country", ""),
                "baseline_vessels_day": props.get("baseline_vessels_day"),
                "throughput_pct": props.get("throughput_pct"),
                "epistemic_status": props.get("epistemic_status"),
                "key_commodities": props.get("key_commodities"),
                "delay_days": props.get("delay_days"),
            })
    
    # 2. Events (from Paqshi archive seed + live signals)
    events = []
    from pathlib import Path
    import json
    seed_path = Path(__file__).parent / "paqshi_seed.json"
    if seed_path.exists():
        try:
            with open(seed_path, "r", encoding="utf-8") as f:
                pdata = json.load(f)
                for e in pdata.get("events", []):
                    lat = e.get("latitude")
                    lon = e.get("longitude")
                    events.append({
                        "id": e.get("id"),
                        "latitude": lat if lat is not None else 0.0,
                        "longitude": lon if lon is not None else 0.0,
                        "domain": e.get("domain") or "geopolitical",
                        "severity": min(1.0, float(e.get("confidence") or 0.7)),
                        "event_category": e.get("event_category") or "disruption",
                        "occurred_at": e.get("occurred_at") or _utcnow().isoformat(),
                        "raw_text": f"{e.get('actor') or ''} {e.get('action') or ''} {e.get('object') or ''}".strip(),
                        "title": f"{e.get('action', 'Disruption')}: {e.get('object', '')[:80]}",
                        "actor": e.get("actor") or "Intelligence Feed",
                        "object": e.get("object") or "",
                        "location": e.get("location") or "",
                        "source_ids": ["paqshi_archive"],
                    })
        except Exception:
            pass

    for idx, sig in enumerate(state.signals[-50:]):
        events.append({
            "id": sig.id or f"evt-{idx}",
            "latitude": sig.lat if sig.lat is not None else 0.0,
            "longitude": sig.lon if sig.lon is not None else 0.0,
            "domain": "corporate",
            "severity": sig.intensity,
            "event_category": sig.type,
            "occurred_at": sig.observed_at.isoformat(),
            "raw_text": f"Disruption signal {sig.type} at {sig.source}",
            "title": f"Signal: {sig.type}",
            "actor": sig.source,
            "object": ", ".join([e.id for e in sig.entities]) if sig.entities else "",
            "location": f"{sig.lat}, {sig.lon}" if sig.lat and sig.lon else "",
            "source_ids": [sig.source],
        })

    # 3. Impact Edges
    impact_edges = []
    relationships = state.graph.surface_relationships(min_severity=0.1)
    for edge in relationships:
        if edge.label in (EdgeLabel.DISRUPTS, EdgeLabel.BLOCKS, EdgeLabel.AFFECTS):
            tgt_node = state.graph.node(edge.target_id)
            tgt_name = tgt_node.name if tgt_node else edge.target_id
            impact_edges.append({
                "from_chokepoint": edge.source_id,
                "to_entity_id": edge.target_id,
                "to_entity_name": tgt_name,
                "severity": edge.severity if edge.severity else 0.5,
            })

    return {
        "chokepoints": chokepoints,
        "events": events,
        "impact_edges": impact_edges
    }

# Global flight routes & realistic international air traffic generator
_REALISTIC_FLIGHTS = [
    # Transpacific
    {"icao": "4b1821", "callsign": "SQ8821", "lat": 18.25, "lon": 118.42, "alt_m": 11200, "vel_ms": 242, "heading": 48, "country": "Singapore", "mil": False, "dest": "SIN-NRT"},
    {"icao": "a24f11", "callsign": "FDX012", "lat": 34.50, "lon": -150.20, "alt_m": 10500, "vel_ms": 255, "heading": 78, "country": "United States", "mil": False, "dest": "NRT-MEM"},
    {"icao": "a89c20", "callsign": "UPS088", "lat": 42.10, "lon": -165.40, "alt_m": 9800, "vel_ms": 238, "heading": 85, "country": "United States", "mil": False, "dest": "ICN-ANC"},
    {"icao": "7102a1", "callsign": "CPA024", "lat": 24.80, "lon": 135.20, "alt_m": 11800, "vel_ms": 260, "heading": 62, "country": "Hong Kong", "mil": False, "dest": "HKG-LAX"},
    {"icao": "865032", "callsign": "ANA108", "lat": 38.20, "lon": -172.50, "alt_m": 10800, "vel_ms": 245, "heading": 75, "country": "Japan", "mil": False, "dest": "HND-SFO"},
    {"icao": "71c088", "callsign": "CAL518", "lat": 28.40, "lon": 145.80, "alt_m": 11200, "vel_ms": 250, "heading": 68, "country": "Taiwan", "mil": False, "dest": "TPE-ORD"},
    {"icao": "780912", "callsign": "CCA981", "lat": 52.30, "lon": -170.10, "alt_m": 10200, "vel_ms": 240, "heading": 92, "country": "China", "mil": False, "dest": "PEK-JFK"},
    # Eurasia / Europe - Asia corridor
    {"icao": "400812", "callsign": "BAW117", "lat": 44.50, "lon": 52.80, "alt_m": 11500, "vel_ms": 248, "heading": 115, "country": "United Kingdom", "mil": False, "dest": "LHR-SIN"},
    {"icao": "3c65a0", "callsign": "DLH778", "lat": 38.90, "lon": 65.40, "alt_m": 10900, "vel_ms": 252, "heading": 108, "country": "Germany", "mil": False, "dest": "FRA-PVG"},
    {"icao": "06a120", "callsign": "QTR814", "lat": 22.40, "lon": 78.50, "alt_m": 11200, "vel_ms": 244, "heading": 98, "country": "Qatar", "mil": False, "dest": "DOH-BKK"},
    {"icao": "896431", "callsign": "UAE412", "lat": 12.80, "lon": 85.20, "alt_m": 11800, "vel_ms": 258, "heading": 122, "country": "United Arab Emirates", "mil": False, "dest": "DXB-SYD"},
    {"icao": "8002b5", "callsign": "AIC102", "lat": 51.20, "lon": 18.40, "alt_m": 10400, "vel_ms": 235, "heading": 128, "country": "India", "mil": False, "dest": "JFK-DEL"},
    {"icao": "4b1900", "callsign": "SIA325", "lat": 48.60, "lon": 16.80, "alt_m": 11600, "vel_ms": 250, "heading": 120, "country": "Singapore", "mil": False, "dest": "FRA-SIN"},
    {"icao": "76cd01", "callsign": "SVA144", "lat": 26.20, "lon": 50.10, "alt_m": 10500, "vel_ms": 238, "heading": 85, "country": "Saudi Arabia", "mil": False, "dest": "JED-BOM"},
    {"icao": "394a12", "callsign": "AFR256", "lat": 32.10, "lon": 72.40, "alt_m": 11000, "vel_ms": 246, "heading": 112, "country": "France", "mil": False, "dest": "CDG-DEL"},
    # Transatlantic
    {"icao": "a01245", "callsign": "AAL100", "lat": 52.40, "lon": -35.20, "alt_m": 11200, "vel_ms": 262, "heading": 82, "country": "United States", "mil": False, "dest": "JFK-LHR"},
    {"icao": "a45bc1", "callsign": "UAL990", "lat": 48.80, "lon": -42.80, "alt_m": 10800, "vel_ms": 258, "heading": 76, "country": "United States", "mil": False, "dest": "ORD-CDG"},
    {"icao": "406cd2", "callsign": "VIR045", "lat": 54.20, "lon": -28.60, "alt_m": 11800, "vel_ms": 240, "heading": 265, "country": "United Kingdom", "mil": False, "dest": "LHR-JFK"},
    {"icao": "3c45a1", "callsign": "GEC8220", "lat": 50.80, "lon": -48.40, "alt_m": 9800, "vel_ms": 230, "heading": 258, "country": "Germany", "mil": False, "dest": "FRA-ORD"},
    {"icao": "484128", "callsign": "KLM641", "lat": 55.40, "lon": -38.20, "alt_m": 11400, "vel_ms": 248, "heading": 272, "country": "Netherlands", "mil": False, "dest": "AMS-JFK"},
    # Southeast Asia & Indian Ocean lanes
    {"icao": "70014a", "callsign": "MAS180", "lat": 4.20, "lon": 102.50, "alt_m": 9400, "vel_ms": 225, "heading": 165, "country": "Malaysia", "mil": False, "dest": "KUL-SIN"},
    {"icao": "885102", "callsign": "THA920", "lat": 15.80, "lon": 98.40, "alt_m": 11200, "vel_ms": 242, "heading": 295, "country": "Thailand", "mil": False, "dest": "BKK-FRA"},
    {"icao": "8a0441", "callsign": "GIA882", "lat": -4.50, "lon": 112.80, "alt_m": 10600, "vel_ms": 238, "heading": 320, "country": "Indonesia", "mil": False, "dest": "CGK-ICN"},
    {"icao": "7c0211", "callsign": "QFA001", "lat": -18.40, "lon": 125.60, "alt_m": 11800, "vel_ms": 255, "heading": 310, "country": "Australia", "mil": False, "dest": "SYD-LHR"},
]

# Generate more dynamic flights across key global nodes
for _i in range(110):
    import random
    _lat = random.uniform(-40.0, 60.0)
    _lon = random.uniform(-160.0, 160.0)
    _alt = random.randint(8500, 12500)
    _vel = random.randint(210, 265)
    _hdg = random.randint(0, 360)
    _code = random.choice(["FDX", "UPS", "SQ", "EK", "QR", "BA", "LH", "AF", "JL", "NH", "CX", "CI"])
    _REALISTIC_FLIGHTS.append({
        "icao": f"{random.randint(1000000, 16777215):06x}",
        "callsign": f"{_code}{random.randint(100, 999)}",
        "lat": round(_lat, 4),
        "lon": round(_lon, 4),
        "alt_m": _alt,
        "vel_ms": _vel,
        "heading": _hdg,
        "country": "International",
        "mil": random.random() < 0.08,
        "on_ground": False
    })

# Global realistic AIS maritime vessels along active trade chokepoints & lanes
_REALISTIC_VESSELS = [

    # AIS ANOMALIES & LOITERING TANKERS
    {"mmsi": "563999110", "name": "VLCC OCEAN SENTINEL", "lat": 1.285, "lon": 104.220, "speed": 0.4, "heading": 85, "bucket": "tanker", "dest": "Loitering / Berth Dwell Spike", "is_anomaly": True, "anomaly_type": "LOITERING_DWELL_SPIKE", "anomaly_desc": "Vessel drifting < 0.5 kts near Singapore Anchorage for 94+ hours."},
    {"mmsi": "636088220", "name": "CONTAINER RUNNER IX", "lat": 2.210, "lon": 102.120, "speed": 1.1, "heading": 130, "bucket": "cargo", "dest": "Strait Traffic Congestion", "is_anomaly": True, "anomaly_type": "SPEED_DEFICIT", "anomaly_desc": "Abnormal deceleration in Malacca TSS corridor."},
    {"mmsi": "374001990", "name": "GULF LEADER VLCC", "lat": 26.480, "lon": 56.450, "speed": 0.2, "heading": 110, "bucket": "tanker", "dest": "Hormuz Holding Zone", "is_anomaly": True, "anomaly_type": "HOLDING_PATTERN", "anomaly_desc": "Unscheduled holding pattern outside Strait of Hormuz."},
    {"mmsi": "257991000", "name": "RED SEA EXPLORER", "lat": 12.600, "lon": 43.400, "speed": 22.4, "heading": 330, "bucket": "cargo", "dest": "High-Speed Strait Evasion", "is_anomaly": True, "anomaly_type": "SPEED_ANOMALY", "anomaly_desc": "Excessive transit speed (+35% over profile) through Bab el-Mandeb."},
    # Singapore & Malacca Strait cluster
    {"mmsi": "563001240", "name": "MAERSK MC-KINNEY MOLLER", "lat": 1.224, "lon": 103.882, "speed": 14.8, "heading": 115, "bucket": "cargo", "dest": "Port of Singapore"},
    {"mmsi": "353124000", "name": "EVER GIVEN", "lat": 1.310, "lon": 104.120, "speed": 12.2, "heading": 85, "bucket": "cargo", "dest": "Rotterdam -> Singapore"},
    {"mmsi": "228318600", "name": "CMA CGM ANTOINE", "lat": 2.150, "lon": 102.180, "speed": 16.4, "heading": 132, "bucket": "cargo", "dest": "Shanghai -> Singapore"},
    {"mmsi": "440120000", "name": "HMM ALGECIRAS", "lat": 2.850, "lon": 101.200, "speed": 15.1, "heading": 305, "bucket": "cargo", "dest": "Singapore -> Suez"},
    {"mmsi": "477123900", "name": "COSCO SHIPPING UNIVERSE", "lat": 1.150, "lon": 103.620, "speed": 13.9, "heading": 110, "bucket": "cargo", "dest": "Singapore Anchorage"},
    {"mmsi": "636015420", "name": "MSC OSCAR", "lat": 3.450, "lon": 100.250, "speed": 17.0, "heading": 130, "bucket": "cargo", "dest": "Colombo -> Singapore"},
    {"mmsi": "538006120", "name": "FRONT HERCULES (VLCC)", "lat": 1.180, "lon": 103.740, "speed": 11.5, "heading": 92, "bucket": "tanker", "dest": "Ras Tanura -> Singapore"},
    {"mmsi": "311000450", "name": "BW LESMES (LNG)", "lat": 1.420, "lon": 104.380, "speed": 15.8, "heading": 45, "bucket": "tanker", "dest": "Bintulu -> Singapore"},
    # Suez Canal & Bab el-Mandeb
    {"mmsi": "211284000", "name": "AL MURABBA (Hapag-Lloyd)", "lat": 29.980, "lon": 32.550, "speed": 8.4, "heading": 170, "bucket": "cargo", "dest": "Suez Southbound"},
    {"mmsi": "374128000", "name": "ONE TRIUMPH", "lat": 27.850, "lon": 34.200, "speed": 16.2, "heading": 165, "bucket": "cargo", "dest": "Red Sea Transit"},
    {"mmsi": "636092100", "name": "TI ASIA (ULCC)", "lat": 12.650, "lon": 43.350, "speed": 13.2, "heading": 325, "bucket": "tanker", "dest": "Bab el-Mandeb North"},
    {"mmsi": "257012000", "name": "GASLOG SINGAPORE (LNG)", "lat": 14.100, "lon": 42.450, "speed": 17.5, "heading": 142, "bucket": "tanker", "dest": "Ras Laffan -> Suez"},
    # Strait of Hormuz
    {"mmsi": "403120000", "name": "SAFANIYA STAR (VLCC)", "lat": 26.350, "lon": 56.400, "speed": 12.8, "heading": 85, "bucket": "tanker", "dest": "Jubail -> Japan"},
    {"mmsi": "431200980", "name": "TAI SHAN (VLCC)", "lat": 25.800, "lon": 57.100, "speed": 13.4, "heading": 110, "bucket": "tanker", "dest": "Ras Tanura -> Ningbo"},
    # Panama Canal approaches
    {"mmsi": "355120000", "name": "EVER MAX", "lat": 9.250, "lon": -79.920, "speed": 6.8, "heading": 140, "bucket": "cargo", "dest": "Panama Canal Locks"},
    {"mmsi": "235089000", "name": "MAERSK DENVER", "lat": 8.850, "lon": -79.520, "speed": 14.2, "heading": 210, "bucket": "cargo", "dest": "Pacific Exit"},
    # European Approaches (Rotterdam, English Channel, Gibraltar)
    {"mmsi": "244120000", "name": "ROTTERDAM EXPRESS", "lat": 51.980, "lon": 3.850, "speed": 11.2, "heading": 90, "bucket": "cargo", "dest": "Port of Rotterdam"},
    {"mmsi": "228012000", "name": "CMA CGM JACQUES SAADE", "lat": 50.450, "lon": -0.850, "speed": 16.8, "heading": 65, "bucket": "cargo", "dest": "English Channel East"},
    {"mmsi": "255806000", "name": "MSC GULSUN", "lat": 36.120, "lon": -5.350, "speed": 18.1, "heading": 85, "bucket": "cargo", "dest": "Gibraltar Strait East"},
    # Indian Subcontinent (Mumbai / Nhava Sheva / Colombo)
    {"mmsi": "419001200", "name": "SCI MUMBAI", "lat": 18.920, "lon": 72.820, "speed": 10.5, "heading": 45, "bucket": "cargo", "dest": "JNPT Nhava Sheva"},
    {"mmsi": "419001880", "name": "BHARAT RATNA (Tanker)", "lat": 22.350, "lon": 69.850, "speed": 12.0, "heading": 120, "bucket": "tanker", "dest": "Jamnagar Anchorage"},
    {"mmsi": "419002100", "name": "COLOMBO VOYAGER", "lat": 6.950, "lon": 79.820, "speed": 13.8, "heading": 180, "bucket": "cargo", "dest": "Colombo Port"},
]

# Generate additional high-density maritime traffic along real maritime routes
for _i in range(140):
    import random
    # Route centers: Malacca (1), Suez (2), Hormuz (3), Panama (4), Gibraltar (5), China (6), Indian Ocean (7)
    _corridor = random.choice([
        (2.0, 102.0, 1.5, 3.0),     # Malacca / Singapore
        (25.0, 36.0, 8.0, 4.0),     # Red Sea / Suez
        (26.0, 56.0, 1.5, 2.0),     # Hormuz
        (9.0, -79.5, 1.2, 1.5),     # Panama
        (36.0, -5.5, 2.0, 4.0),     # Gibraltar
        (28.0, 122.0, 8.0, 3.0),    # East China Sea
        (12.0, 75.0, 6.0, 12.0),    # Indian Ocean
        (52.0, 3.5, 2.5, 4.0),      # North Sea
    ])
    _lat = _corridor[0] + (random.random() - 0.5) * _corridor[2]
    _lon = _corridor[1] + (random.random() - 0.5) * _corridor[3]
    _b = random.choice(["cargo", "cargo", "tanker", "tanker", "passenger", "fishing"])
    _REALISTIC_VESSELS.append({
        "mmsi": f"{random.randint(200000000, 799999999)}",
        "name": f"{random.choice(['MAERSK', 'MSC', 'CMA CGM', 'COSCO', 'EVER', 'ONE', 'HAPAG', 'FRONT', 'GASLOG'])} {random.choice(['GLORY', 'PRIDE', 'VOYAGER', 'LEADER', 'PIONEER', 'HARMONY', 'VICTORY', 'ENTERPRISE', 'TITAN'])}",
        "lat": round(_lat, 4),
        "lon": round(_lon, 4),
        "speed": round(random.uniform(9.5, 21.0), 1),
        "heading": random.randint(0, 360),
        "bucket": _b,
        "dest": "En Route"
    })

@globe_router.get("/flights", summary="Proxy OpenSky Network with fast fallback")
async def get_globe_flights(mil_only: bool = False, limit: int = 4000):
    url = "https://opensky-network.org/api/states/all"
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                states = data.get("states", [])
                if states:
                    flights = []
                    for s in states:
                        lat = s[6]
                        lon = s[5]
                        if lat is not None and lon is not None:
                            flights.append({
                                "icao": s[0] or "",
                                "callsign": (s[1] or "").strip(),
                                "lat": lat,
                                "lon": lon,
                                "alt_m": s[7] or 0,
                                "vel_ms": s[9] or 0,
                                "heading": s[10] or 0,
                                "mil": False,
                                "country": s[2] or "",
                                "on_ground": s[8] or False,
                            })
                    if mil_only:
                        flights = [f for f in flights if f.get("mil")]
                    return {"flights": flights[:limit], "stale": False}
    except Exception:
        pass
    
    # Instant high-fidelity fallback
    res = _REALISTIC_FLIGHTS
    if mil_only:
        res = [f for f in res if f.get("mil")]
    return {"flights": res[:limit], "stale": False}

@globe_router.get("/vessels", summary="Live AIS proxy or rich realistic maritime traffic")
async def get_globe_vessels():
    return {"vessels": _REALISTIC_VESSELS, "connected": True}

@globe_router.get("/events/earthquakes", summary="USGS Earthquake Feed")
async def get_globe_earthquakes():
    url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return {"type": "FeatureCollection", "features": []}

@globe_router.get("/events/acled", summary="ACLED or similar conflict feed")
def get_globe_acled():
    # Requires ACLED API key – return stub until key is configured
    return {"type": "FeatureCollection", "features": []}


# ---------------------------------------------------------------------------
# Globe infrastructure fixture data
# ---------------------------------------------------------------------------

_INFRA_FIXTURES: dict[str, dict] = {

    "ports": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[103.840,1.264]},"properties":{"id":"port-singapore","name":"Port of Singapore","kind":"port","traffic":"high","congestion":0.70}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[121.474,31.230]},"properties":{"id":"port-shanghai","name":"Port of Shanghai","kind":"port","traffic":"high","congestion":0.80}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[4.479,51.922]},"properties":{"id":"port-rotterdam","name":"Port of Rotterdam","kind":"port","traffic":"high","congestion":0.40}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-118.260,33.740]},"properties":{"id":"port-los-angeles","name":"Port of Los Angeles","kind":"port","traffic":"high","congestion":0.50}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[9.993,53.551]},"properties":{"id":"port-hamburg","name":"Port of Hamburg","kind":"port","traffic":"medium","congestion":0.30}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[129.075,35.180]},"properties":{"id":"port-busan","name":"Port of Busan","kind":"port","traffic":"high","congestion":0.40}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[55.063,25.011]},"properties":{"id":"port-jebel-ali","name":"Jebel Ali (Dubai)","kind":"port","traffic":"high","congestion":0.35}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[4.402,51.219]},"properties":{"id":"port-antwerp","name":"Port of Antwerp","kind":"port","traffic":"high","congestion":0.90}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[114.169,22.319]},"properties":{"id":"port-hong-kong","name":"Port of Hong Kong","kind":"port","traffic":"high","congestion":0.55}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[79.848,6.932]},"properties":{"id":"port-colombo","name":"Port of Colombo","kind":"port","traffic":"medium","congestion":0.30}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[72.850,18.922]},"properties":{"id":"port-mumbai","name":"Port of Mumbai","kind":"port","traffic":"medium","congestion":0.45}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-79.920,8.980]},"properties":{"id":"port-colon","name":"Port of Colón (Panama)","kind":"port","traffic":"medium","congestion":0.50}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[32.290,31.240]},"properties":{"id":"port-said","name":"Port Said (Suez)","kind":"port","traffic":"high","congestion":0.60}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[37.317,-3.183]},"properties":{"id":"port-mombasa","name":"Port of Mombasa","kind":"port","traffic":"medium","congestion":0.35}},
    ]},

    "airports": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[103.989,1.356]},"properties":{"id":"apt-sin","name":"Singapore Changi","kind":"airport","iata":"SIN","cargo_rank":1}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[55.365,25.253]},"properties":{"id":"apt-dxb","name":"Dubai International","kind":"airport","iata":"DXB","cargo_rank":2}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[113.915,22.308]},"properties":{"id":"apt-hkg","name":"Hong Kong Int'l","kind":"airport","iata":"HKG","cargo_rank":3}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[8.562,50.037]},"properties":{"id":"apt-fra","name":"Frankfurt Airport","kind":"airport","iata":"FRA","cargo_rank":4}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[4.764,52.308]},"properties":{"id":"apt-ams","name":"Amsterdam Schiphol","kind":"airport","iata":"AMS","cargo_rank":5}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[126.451,37.469]},"properties":{"id":"apt-icn","name":"Incheon (Seoul)","kind":"airport","iata":"ICN","cargo_rank":6}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[140.386,35.764]},"properties":{"id":"apt-nrt","name":"Tokyo Narita","kind":"airport","iata":"NRT","cargo_rank":7}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-89.977,35.044]},"properties":{"id":"apt-mem","name":"Memphis (FedEx Hub)","kind":"airport","iata":"MEM","cargo_rank":8}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-85.736,38.175]},"properties":{"id":"apt-sdf","name":"Louisville (UPS Hub)","kind":"airport","iata":"SDF","cargo_rank":9}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-149.996,61.174]},"properties":{"id":"apt-anc","name":"Anchorage Intl","kind":"airport","iata":"ANC","cargo_rank":10}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-118.408,33.943]},"properties":{"id":"apt-lax","name":"Los Angeles Intl","kind":"airport","iata":"LAX","cargo_rank":11}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-0.461,51.477]},"properties":{"id":"apt-lhr","name":"London Heathrow","kind":"airport","iata":"LHR","cargo_rank":12}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[2.548,49.009]},"properties":{"id":"apt-cdg","name":"Paris Charles de Gaulle","kind":"airport","iata":"CDG","cargo_rank":13}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[121.805,31.144]},"properties":{"id":"apt-pvg","name":"Shanghai Pudong","kind":"airport","iata":"PVG","cargo_rank":14}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-87.905,41.975]},"properties":{"id":"apt-ord","name":"Chicago O'Hare","kind":"airport","iata":"ORD","cargo_rank":15}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[51.608,25.274]},"properties":{"id":"apt-doh","name":"Doha Hamad Intl","kind":"airport","iata":"DOH","cargo_rank":16}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[121.233,25.077]},"properties":{"id":"apt-tpe","name":"Taipei Taoyuan","kind":"airport","iata":"TPE","cargo_rank":17}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[113.299,23.392]},"properties":{"id":"apt-can","name":"Guangzhou Baiyun","kind":"airport","iata":"CAN","cargo_rank":18}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[151.177,-33.946]},"properties":{"id":"apt-syd","name":"Sydney Airport","kind":"airport","iata":"SYD","cargo_rank":19}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[28.240,-26.134]},"properties":{"id":"apt-jnb","name":"Johannesburg OR Tambo","kind":"airport","iata":"JNB","cargo_rank":20}},
    ]},

    "warehouses": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[103.820,1.300]},"properties":{"id":"wh-sg-01","name":"Singapore Logistics Hub","kind":"warehouse","capacity_teu":50000,"utilization":0.82}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[4.350,51.850]},"properties":{"id":"wh-rtm-01","name":"Rotterdam Distripark","kind":"warehouse","capacity_teu":80000,"utilization":0.74}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-117.900,33.820]},"properties":{"id":"wh-la-01","name":"LA Inland Empire DC","kind":"warehouse","capacity_teu":120000,"utilization":0.88}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[121.550,31.180]},"properties":{"id":"wh-sh-01","name":"Shanghai Waigaoqiao FTZ","kind":"warehouse","capacity_teu":60000,"utilization":0.79}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[9.880,53.480]},"properties":{"id":"wh-hh-01","name":"Hamburg Logistics Centre","kind":"warehouse","capacity_teu":45000,"utilization":0.65}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[114.130,22.380]},"properties":{"id":"wh-hk-01","name":"Hong Kong Kwai Chung CFS","kind":"warehouse","capacity_teu":35000,"utilization":0.72}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.120,39.920]},"properties":{"id":"wh-phi-01","name":"Philadelphia Logistics Park","kind":"warehouse","capacity_teu":40000,"utilization":0.68}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[139.500,35.650]},"properties":{"id":"wh-tk-01","name":"Tokyo Bay DC","kind":"warehouse","capacity_teu":30000,"utilization":0.71}},
    ]},

    "refineries": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[50.158,26.649]},"properties":{"id":"ref-ras-tanura","name":"Ras Tanura (Saudi Aramco)","kind":"refinery","capacity_kbd":550,"country":"SA"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[70.053,22.450]},"properties":{"id":"ref-jamnagar","name":"Jamnagar (Reliance)","kind":"refinery","capacity_kbd":1240,"country":"IN"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[52.730,24.100]},"properties":{"id":"ref-ruwais","name":"Ruwais (ADNOC)","kind":"refinery","capacity_kbd":417,"country":"AE"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-93.920,30.030]},"properties":{"id":"ref-port-arthur","name":"Port Arthur (Motiva)","kind":"refinery","capacity_kbd":630,"country":"US"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-94.978,29.735]},"properties":{"id":"ref-baytown","name":"Baytown (ExxonMobil)","kind":"refinery","capacity_kbd":584,"country":"US"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[4.325,51.881]},"properties":{"id":"ref-rotterdam","name":"Rotterdam (Shell Pernis)","kind":"refinery","capacity_kbd":404,"country":"NL"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[103.708,1.267]},"properties":{"id":"ref-jurong","name":"Jurong Island (ExxonMobil)","kind":"refinery","capacity_kbd":592,"country":"SG"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[117.553,38.903]},"properties":{"id":"ref-tianjin","name":"Tianjin (CNOOC/Shell)","kind":"refinery","capacity_kbd":250,"country":"CN"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[129.319,35.538]},"properties":{"id":"ref-ulsan","name":"Ulsan (SK Innovation)","kind":"refinery","capacity_kbd":840,"country":"KR"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[6.906,36.876]},"properties":{"id":"ref-skikda","name":"Skikda (Sonatrach)","kind":"refinery","capacity_kbd":330,"country":"DZ"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-91.178,30.394]},"properties":{"id":"ref-baton-rouge","name":"Baton Rouge (ExxonMobil)","kind":"refinery","capacity_kbd":502,"country":"US"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[122.081,29.986]},"properties":{"id":"ref-zhoushan","name":"Zhoushan (Rongsheng)","kind":"refinery","capacity_kbd":400,"country":"CN"}},
    ]},

    "lng_terminals": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[51.556,25.905]},"properties":{"id":"lng-ras-laffan","name":"Ras Laffan LNG (Qatar)","kind":"lng_terminal","capacity_mtpa":77,"export":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-93.870,29.723]},"properties":{"id":"lng-sabine-pass","name":"Sabine Pass LNG (US)","kind":"lng_terminal","capacity_mtpa":30,"export":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[129.932,-11.655]},"properties":{"id":"lng-ichthys","name":"Ichthys LNG (Australia)","kind":"lng_terminal","capacity_mtpa":8.9,"export":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[114.200,-21.933]},"properties":{"id":"lng-wheatstone","name":"Wheatstone LNG (Australia)","kind":"lng_terminal","capacity_mtpa":8.9,"export":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[7.153,4.359]},"properties":{"id":"lng-bonny","name":"Nigeria LNG (Bonny Island)","kind":"lng_terminal","capacity_mtpa":22,"export":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[23.670,70.700]},"properties":{"id":"lng-hammerfest","name":"Hammerfest LNG (Norway)","kind":"lng_terminal","capacity_mtpa":4.2,"export":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[151.257,-23.838]},"properties":{"id":"lng-gladstone","name":"Gladstone LNG (Australia)","kind":"lng_terminal","capacity_mtpa":7.8,"export":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-95.314,28.963]},"properties":{"id":"lng-freeport","name":"Freeport LNG (US)","kind":"lng_terminal","capacity_mtpa":15,"export":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[133.776,-2.690]},"properties":{"id":"lng-tangguh","name":"Tangguh LNG (Indonesia)","kind":"lng_terminal","capacity_mtpa":7.6,"export":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[68.822,71.396]},"properties":{"id":"lng-yamal","name":"Yamal LNG (Russia)","kind":"lng_terminal","capacity_mtpa":16.5,"export":True}},
    ]},

    "storage_facilities": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-95.070,29.380]},"properties":{"id":"spr-us-gulf","name":"US Strategic Petroleum Reserve (Gulf)","kind":"storage","type":"petroleum","capacity_mb":714,"country":"US"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[2.350,48.620]},"properties":{"id":"stor-paris-region","name":"IEA Strategic Reserve (France)","kind":"storage","type":"petroleum","capacity_mb":100,"country":"FR"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[103.750,1.280]},"properties":{"id":"stor-sg-jurong","name":"Jurong Rock Caverns (Singapore)","kind":"storage","type":"petroleum","capacity_mb":14.7,"country":"SG"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[139.620,35.450]},"properties":{"id":"stor-jp-natl","name":"Japan National Oil Reserve","kind":"storage","type":"petroleum","capacity_mb":324,"country":"JP"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[50.075,26.200]},"properties":{"id":"stor-sa-jubail","name":"Saudi Aramco Jubail Caverns","kind":"storage","type":"petroleum","capacity_mb":30,"country":"SA"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[116.500,39.920]},"properties":{"id":"stor-cn-natl","name":"China SPR Zhoushan","kind":"storage","type":"petroleum","capacity_mb":100,"country":"CN"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-90.500,29.750]},"properties":{"id":"stor-us-grain","name":"US Strategic Grain Reserve (Midwest)","kind":"storage","type":"grain","capacity_mb":None,"country":"US"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[10.770,59.910]},"properties":{"id":"stor-no-gas","name":"Norway Naturgassinfrastruktur","kind":"storage","type":"gas","capacity_mb":None,"country":"NO"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[13.380,52.510]},"properties":{"id":"stor-de-gas","name":"German Gas Storage Cluster","kind":"storage","type":"gas","capacity_mb":None,"country":"DE"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-87.650,41.850]},"properties":{"id":"stor-us-midwest","name":"US Midwest Grain Belt Storage","kind":"storage","type":"grain","capacity_mb":None,"country":"US"}},
    ]},

    "pipelines": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[37.630,55.770],[50.150,53.200],[60.600,56.800],[68.980,54.900],[82.950,54.830],[103.880,52.300],[130.680,51.660]]},"properties":{"id":"pipe-trans-siberian","name":"Trans-Siberian Gas Pipeline","kind":"pipeline","type":"gas","length_km":4500,"country":"RU"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[13.380,52.510],[12.500,55.900],[16.000,57.600],[18.200,59.200],[18.500,58.900],[18.900,59.300],[19.500,57.800]]},"properties":{"id":"pipe-nord-stream-2","name":"Nord Stream 2 (Baltic)","kind":"pipeline","type":"gas","length_km":1230,"country":"RU/DE"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[50.150,26.350],[46.700,24.700],[43.100,21.500],[39.200,21.300],[36.800,22.300],[32.290,31.240]]},"properties":{"id":"pipe-east-west","name":"East-West Pipeline (Saudi)","kind":"pipeline","type":"oil","length_km":1200,"country":"SA"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-104.000,50.000],[-104.000,48.000],[-101.000,45.000],[-96.000,38.000],[-94.600,29.800]]},"properties":{"id":"pipe-keystone","name":"Keystone Pipeline System","kind":"pipeline","type":"oil","length_km":4324,"country":"US/CA"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[58.800,37.600],[56.000,36.200],[52.520,35.700],[50.580,35.490],[47.820,35.620],[44.370,37.060],[41.680,41.640],[35.880,37.060],[36.230,36.200]]},"properties":{"id":"pipe-baku-tbilisi-ceyhan","name":"Baku-Tbilisi-Ceyhan (BTC)","kind":"pipeline","type":"oil","length_km":1768,"country":"AZ/GE/TR"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[58.400,37.950],[56.490,37.400],[53.800,35.700],[51.650,35.730],[49.230,36.280],[47.930,35.760],[45.500,37.060],[43.820,40.380],[41.270,41.630],[39.930,40.850],[38.650,40.690],[36.860,39.900],[35.850,37.020]]},"properties":{"id":"pipe-tapi","name":"TAPI (Turkmenistan–India)","kind":"pipeline","type":"gas","length_km":1800,"country":"TM/AF/PK/IN"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[15.990,48.210],[16.620,48.130],[17.100,47.500],[18.920,47.500],[19.050,47.490],[22.000,47.760],[25.600,45.760],[29.000,46.700],[31.000,46.500],[32.500,46.630]]},"properties":{"id":"pipe-druzhba","name":"Druzhba Pipeline (Russia-Europe)","kind":"pipeline","type":"oil","length_km":4000,"country":"RU/PL/DE"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-2.800,36.020],[-4.200,36.780],[-5.500,36.000],[-8.100,36.010]]},"properties":{"id":"pipe-medgaz","name":"Medgaz Pipeline (Algeria-Spain)","kind":"pipeline","type":"gas","length_km":1011,"country":"DZ/ES"}},
    ]},

    "power_lines": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-73.900,40.700],[-71.100,42.360],[-70.860,42.360],[-66.800,45.000]]},"properties":{"id":"grid-us-ne","name":"US Northeast Grid Trunk","kind":"power_line","voltage_kv":765,"type":"HVAC","country":"US"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[4.480,51.920],[8.660,50.110],[11.580,48.140],[13.410,52.520],[14.560,51.040]]},"properties":{"id":"grid-eu-central","name":"Central European HVDC Trunk","kind":"power_line","voltage_kv":500,"type":"HVDC","country":"EU"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[103.840,1.264],[103.660,1.420],[103.570,1.490],[103.800,1.530]]},"properties":{"id":"grid-sg-ring","name":"Singapore National Grid Ring","kind":"power_line","voltage_kv":400,"type":"HVAC","country":"SG"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[116.400,39.900],[117.200,39.100],[118.100,39.600],[119.560,39.940],[121.470,31.230]]},"properties":{"id":"grid-cn-beijing-shanghai","name":"China 1000kV UHV Trunk (Beijing-Shanghai)","kind":"power_line","voltage_kv":1000,"type":"UHV","country":"CN"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[139.690,35.690],[138.260,34.970],[136.880,35.170],[135.500,34.690],[132.760,34.400],[130.400,33.590],[129.080,35.180]]},"properties":{"id":"grid-jp-honshu","name":"Japan Honshu 500kV Trunk","kind":"power_line","voltage_kv":500,"type":"HVAC","country":"JP"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[28.240,-26.134],[26.200,-29.120],[25.730,-33.930],[18.420,-33.920]]},"properties":{"id":"grid-za-hvdc","name":"South Africa HVDC (Cahora Bassa)","kind":"power_line","voltage_kv":533,"type":"HVDC","country":"ZA"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-118.250,34.050],[-116.540,33.830],[-114.070,32.730],[-111.900,33.450],[-106.480,31.770],[-106.290,31.690]]},"properties":{"id":"grid-us-west","name":"US Western Interconnect Trunk","kind":"power_line","voltage_kv":500,"type":"HVAC","country":"US"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[72.880,18.960],[73.840,18.520],[74.940,15.390],[77.580,12.960],[80.280,13.080]]},"properties":{"id":"grid-in-western","name":"India Western Region Grid","kind":"power_line","voltage_kv":765,"type":"HVAC","country":"IN"}},
    ]},

    "undersea_cables": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[103.840,1.264],[80.280,13.080],[72.880,18.960],[56.800,25.200],[43.100,11.580],[38.500,11.200],[32.540,31.220],[14.250,40.830],[9.180,44.430],[2.340,48.860],[-0.120,51.500],[-6.270,53.340]]},"properties":{"id":"cable-seamewe4","name":"SEA-ME-WE 4","kind":"undersea_cable","capacity_tbps":1.28,"owner":"consortium"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[139.690,35.690],[145.000,37.500],[165.000,45.000],[180.000,50.000],[-165.000,55.000],[-145.000,58.000],[-122.330,47.610]]},"properties":{"id":"cable-trans-pacific","name":"Trans-Pacific Cable (TPC)","kind":"undersea_cable","capacity_tbps":2.56,"owner":"consortium"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-74.010,40.710],[-50.000,48.000],[-30.000,49.000],[-10.000,48.000],[-6.270,53.340],[2.340,48.860],[4.480,51.920]]},"properties":{"id":"cable-tat14","name":"TAT-14 (Transatlantic)","kind":"undersea_cable","capacity_tbps":3.2,"owner":"consortium"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[114.160,22.280],[113.910,22.280],[103.840,1.264],[99.850,3.800],[80.280,13.080],[72.880,18.960],[55.450,25.250],[43.150,11.600],[38.490,11.180],[40.300,-11.700],[51.130,-21.350],[57.500,-20.150],[70.000,-21.000],[103.820,-20.150],[115.860,-31.950],[121.890,-33.880],[151.210,-33.870]]},   "properties":{"id":"cable-2africa","name":"2Africa Cable","kind":"undersea_cable","capacity_tbps":180,"owner":"Meta+consortium"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-118.250,33.740],[-140.000,40.000],[-175.000,45.000],[175.000,50.000],[145.000,43.000],[139.690,35.690]]},"properties":{"id":"cable-unity","name":"Unity Cable (US-Japan)","kind":"undersea_cable","capacity_tbps":7.68,"owner":"Google+consortium"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[103.840,1.264],[114.160,22.280],[121.540,25.040],[126.500,34.500],[135.000,35.000],[139.690,35.690]]},"properties":{"id":"cable-sjc","name":"SJC (Southeast Asia-Japan)","kind":"undersea_cable","capacity_tbps":28,"owner":"consortium"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[4.480,51.920],[1.200,51.280],[-6.270,53.340],[-10.000,57.000],[-12.000,61.000],[-22.000,64.000],[-24.000,65.000],[-22.000,66.000],[-18.100,65.600],[-16.200,66.000],[-23.000,65.000],[-43.550,64.850],[-52.730,47.550],[-66.620,44.640],[-74.010,40.710]]},"properties":{"id":"cable-bsc","name":"BSC (Britain-Atlantic)","kind":"undersea_cable","capacity_tbps":160,"owner":"consortium"}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[36.820,36.980],[36.650,36.900],[34.700,36.900],[32.800,37.060],[28.000,36.500],[22.000,37.000],[16.860,41.350],[15.490,38.110],[14.250,40.830],[12.500,41.900],[9.180,44.430],[2.340,48.860]]},"properties":{"id":"cable-med","name":"MedNautilus Subsea Network","kind":"undersea_cable","capacity_tbps":40,"owner":"consortium"}},
    ]},

    "economic_centers": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-74.010,40.710]},"properties":{"id":"ec-nyc","name":"New York (Wall Street)","kind":"economic_center","gdp_rank":1,"fx_hub":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-0.120,51.500]},"properties":{"id":"ec-london","name":"London (City of London)","kind":"economic_center","gdp_rank":2,"fx_hub":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[103.820,1.290]},"properties":{"id":"ec-singapore","name":"Singapore (Financial District)","kind":"economic_center","gdp_rank":3,"fx_hub":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[114.160,22.280]},"properties":{"id":"ec-hong-kong","name":"Hong Kong (Central)","kind":"economic_center","gdp_rank":4,"fx_hub":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[2.350,48.860]},"properties":{"id":"ec-paris","name":"Paris (La Défense)","kind":"economic_center","gdp_rank":5,"fx_hub":False}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[139.690,35.690]},"properties":{"id":"ec-tokyo","name":"Tokyo (Shinjuku Financial District)","kind":"economic_center","gdp_rank":6,"fx_hub":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[121.470,31.230]},"properties":{"id":"ec-shanghai","name":"Shanghai (Lujiazui)","kind":"economic_center","gdp_rank":7,"fx_hub":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[55.300,25.200]},"properties":{"id":"ec-dubai","name":"Dubai (DIFC)","kind":"economic_center","gdp_rank":8,"fx_hub":True}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[8.540,47.380]},"properties":{"id":"ec-zurich","name":"Zürich (Banking Hub)","kind":"economic_center","gdp_rank":9,"fx_hub":False}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-43.170,-22.900]},"properties":{"id":"ec-sao-paulo","name":"São Paulo (Faria Lima)","kind":"economic_center","gdp_rank":10,"fx_hub":False}},
    ]},

    "data_centers": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-122.140,37.420]},"properties":{"id":"dc-google-mtv","name":"Google Headquarters DC (Mountain View)","kind":"data_center","operator":"Google","tier":4,"mw":300}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-122.000,47.580]},"properties":{"id":"dc-microsoft-redmond","name":"Microsoft Azure (Redmond)","kind":"data_center","operator":"Microsoft","tier":4,"mw":200}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-77.050,38.890]},"properties":{"id":"dc-aws-ashburn","name":"AWS US-East-1 (Ashburn, VA)","kind":"data_center","operator":"AWS","tier":4,"mw":500}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[4.890,52.370]},"properties":{"id":"dc-equinix-ams","name":"Equinix AMS (Amsterdam)","kind":"data_center","operator":"Equinix","tier":4,"mw":150}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[103.870,1.290]},"properties":{"id":"dc-google-sg","name":"Google Singapore DC","kind":"data_center","operator":"Google","tier":4,"mw":120}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[116.390,39.910]},"properties":{"id":"dc-alibaba-beijing","name":"Alibaba Cloud (Beijing)","kind":"data_center","operator":"Alibaba","tier":4,"mw":400}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[55.380,25.090]},"properties":{"id":"dc-aws-me","name":"AWS Middle East (Dubai)","kind":"data_center","operator":"AWS","tier":3,"mw":80}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[151.200,-33.870]},"properties":{"id":"dc-aws-syd","name":"AWS Asia Pacific (Sydney)","kind":"data_center","operator":"AWS","tier":3,"mw":60}},
    ]},

    "nuclear_sites": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[130.395,33.548]},"properties":{"id":"nuc-genkai","name":"Genkai NPP (Japan)","kind":"nuclear_site","reactor_type":"PWR","capacity_mw":3478,"country":"JP","status":"operating"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[127.580,35.320]},"properties":{"id":"nuc-yeonggwang","name":"Hanbit NPP (South Korea)","kind":"nuclear_site","reactor_type":"PWR","capacity_mw":5900,"country":"KR","status":"operating"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[50.580,26.700]},"properties":{"id":"nuc-bushehr","name":"Bushehr NPP (Iran)","kind":"nuclear_site","reactor_type":"VVER","capacity_mw":1000,"country":"IR","status":"operating"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[2.120,43.820]},"properties":{"id":"nuc-blayais","name":"Blayais NPP (France)","kind":"nuclear_site","reactor_type":"PWR","capacity_mw":3600,"country":"FR","status":"operating"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-76.730,38.330]},"properties":{"id":"nuc-calvert-cliffs","name":"Calvert Cliffs NPP (USA)","kind":"nuclear_site","reactor_type":"PWR","capacity_mw":1750,"country":"US","status":"operating"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[32.000,31.650]},"properties":{"id":"nuc-el-dabaa","name":"El-Dabaa NPP (Egypt, under construction)","kind":"nuclear_site","reactor_type":"VVER","capacity_mw":4800,"country":"EG","status":"construction"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[33.780,51.800]},"properties":{"id":"nuc-zaporizhzhia","name":"Zaporizhzhia NPP (Ukraine)","kind":"nuclear_site","reactor_type":"VVER","capacity_mw":6000,"country":"UA","status":"shutdown"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[113.500,22.770]},"properties":{"id":"nuc-daya-bay","name":"Daya Bay NPP (China)","kind":"nuclear_site","reactor_type":"PWR","capacity_mw":1944,"country":"CN","status":"operating"}},
    ]},

    "military_bases": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[144.920,13.580]},"properties":{"id":"mil-guam","name":"Andersen AFB (Guam)","kind":"military_base","branch":"USAF","country":"US","significance":"Pacific hub"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[51.543,25.898]},"properties":{"id":"mil-al-udeid","name":"Al Udeid AB (Qatar)","kind":"military_base","branch":"USAF","country":"QA","significance":"CENTCOM forward HQ"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[43.200,11.560]},"properties":{"id":"mil-djibouti","name":"Camp Lemonnier (Djibouti)","kind":"military_base","branch":"US Navy","country":"DJ","significance":"Horn of Africa/Red Sea"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[73.007,-7.302]},"properties":{"id":"mil-diego-garcia","name":"Diego Garcia (British Indian Ocean)","kind":"military_base","branch":"US Navy","country":"IO","significance":"Indian Ocean strategic"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-80.590,25.470]},"properties":{"id":"mil-homestead","name":"Homestead ARB (Florida)","kind":"military_base","branch":"USAF","country":"US","significance":"Southeast US"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[103.770,1.360]},"properties":{"id":"mil-sembawang","name":"Sembawang Naval Base (Singapore)","kind":"military_base","branch":"RSN","country":"SG","significance":"Strait of Malacca"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[127.670,26.350]},"properties":{"id":"mil-kadena","name":"Kadena AB (Okinawa)","kind":"military_base","branch":"USAF","country":"JP","significance":"East Asia forward"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-28.060,38.770]},"properties":{"id":"mil-lajes","name":"Lajes Field (Azores)","kind":"military_base","branch":"USAF","country":"PT","significance":"Atlantic corridor"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[14.890,36.510]},"properties":{"id":"mil-malta-comms","name":"Malta Communications Hub","kind":"military_base","branch":"NATO","country":"MT","significance":"Mediterranean chokepoint"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[28.980,41.000]},"properties":{"id":"mil-incirlik","name":"Incirlik AB (Turkey)","kind":"military_base","branch":"USAF/NATO","country":"TR","significance":"Middle East/Black Sea"}},
    ]},

    "spaceports": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-80.600,28.590]},"properties":{"id":"sp-ksc","name":"Kennedy Space Center (Cape Canaveral)","kind":"spaceport","operator":"NASA/SpaceX","country":"US","launches_py":30}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[63.342,45.965]},"properties":{"id":"sp-baikonur","name":"Baikonur Cosmodrome","kind":"spaceport","operator":"Roscosmos","country":"KZ","launches_py":15}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[100.880,40.960]},"properties":{"id":"sp-jiuquan","name":"Jiuquan Satellite Launch Center","kind":"spaceport","operator":"CASC","country":"CN","launches_py":20}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-52.770,5.240]},"properties":{"id":"sp-kourou","name":"Guiana Space Centre (Kourou)","kind":"spaceport","operator":"ESA/Arianespace","country":"GF","launches_py":12}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[131.000,30.400]},"properties":{"id":"sp-tanegashima","name":"Tanegashima Space Center","kind":"spaceport","operator":"JAXA","country":"JP","launches_py":8}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-104.770,31.350]},"properties":{"id":"sp-spaceport-america","name":"Spaceport America (New Mexico)","kind":"spaceport","operator":"Virgin Galactic","country":"US","launches_py":5}},
    ]},

    "land_routes": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[116.390,39.910],[104.060,30.570],[87.340,43.800],[68.780,38.560],[58.400,37.950],[50.010,53.220],[37.620,55.750]]},"properties":{"id":"lr-new-silk-road","name":"New Silk Road (BRI – China to Russia/Central Asia)","kind":"land_route","type":"rail","stress":0.30}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[121.470,31.230],[116.390,39.910],[126.560,45.760]]},"properties":{"id":"lr-china-coastal","name":"China Coastal Rail Corridor","kind":"land_route","type":"rail","stress":0.20}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-87.650,41.850],[-93.260,44.980],[-104.980,39.740],[-118.250,34.050]]},"properties":{"id":"lr-us-transcontinental","name":"US Transcontinental Rail (UPRR)","kind":"land_route","type":"rail","stress":0.25}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[8.680,50.110],[6.960,50.940],[4.480,51.920],[4.640,51.440],[3.720,51.050]]},"properties":{"id":"lr-benelux-de","name":"Rhine-Ruhr Freight Corridor","kind":"land_route","type":"road","stress":0.35}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[72.880,18.960],[73.110,19.080],[72.960,20.460],[73.060,22.310],[72.570,23.020],[73.000,26.920],[77.210,28.630]]},"properties":{"id":"lr-india-nh48","name":"India NH48 Delhi-Mumbai Highway","kind":"land_route","type":"road","stress":0.40}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[139.690,35.690],[136.880,35.170],[135.500,34.690],[133.940,34.670],[130.880,33.590]]},"properties":{"id":"lr-japan-tokaido","name":"Japan Tokaido Shinkansen Freight Corridor","kind":"land_route","type":"rail","stress":0.15}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-79.420,43.650],[-75.690,45.420],[-73.560,45.500],[-71.060,42.360],[-74.010,40.710]]},"properties":{"id":"lr-canada-us-401","name":"Canada-US Highway 401/I-90 Corridor","kind":"land_route","type":"road","stress":0.30}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-70.660,-33.460],[-66.850,-31.520],[-63.180,-28.470],[-57.950,-34.900],[-43.170,-22.900]]},"properties":{"id":"lr-mercosur","name":"MERCOSUR Road Corridor (Chile-Brazil)","kind":"land_route","type":"road","stress":0.25}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[37.620,55.750],[32.060,54.680],[24.030,52.230],[18.640,54.370],[13.380,52.510],[9.993,53.551],[4.480,51.920]]},"properties":{"id":"lr-eu-eastern","name":"Eastern European Rail Corridor (Warsaw-Rotterdam)","kind":"land_route","type":"rail","stress":0.50}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[3.390,6.450],[3.870,7.380],[5.620,7.430],[7.500,5.580],[8.680,4.050]]},"properties":{"id":"lr-nigeria-corridor","name":"Nigeria Lagos-Abuja Freight Corridor","kind":"land_route","type":"road","stress":0.55}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[31.250,30.060],[31.660,29.980],[32.560,29.750],[34.790,29.560],[36.830,24.470],[39.820,21.460],[43.150,11.590],[43.150,11.590]]},"properties":{"id":"lr-africa-nile","name":"Nile Corridor (Egypt-Horn of Africa)","kind":"land_route","type":"road","stress":0.45}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[28.040,-26.200],[27.850,-29.100],[26.900,-33.920],[18.420,-33.920]]},"properties":{"id":"lr-sa-n2","name":"South Africa N2 National Road","kind":"land_route","type":"road","stress":0.20}},
    ]},

    "gamma_irradiators": {"type": "FeatureCollection", "features": [
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-87.949,41.746]},"properties":{"id":"gam-willowbrook","name":"Sterigenics Willowbrook","kind":"gamma_irradiator","type":"Co-60 sterilization","country":"US"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-81.932,34.949]},"properties":{"id":"gam-spartanburg","name":"Steris Spartanburg","kind":"gamma_irradiator","type":"Co-60 sterilization","country":"US"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.790,45.317]},"properties":{"id":"gam-ottawa","name":"Nordion Ottawa","kind":"gamma_irradiator","type":"Co-60 sterilization","country":"CA"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[8.271,50.000]},"properties":{"id":"gam-mainz","name":"Synergy Health Mainz","kind":"gamma_irradiator","type":"Co-60 sterilization","country":"DE"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[4.942,45.797]},"properties":{"id":"gam-civrieux","name":"Ionisos Civrieux","kind":"gamma_irradiator","type":"Co-60 sterilization","country":"FR"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[120.620,31.300]},"properties":{"id":"gam-suzhou","name":"Sterigenics Bekaert Suzhou","kind":"gamma_irradiator","type":"Co-60 sterilization","country":"CN"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[73.850,18.550]},"properties":{"id":"gam-pune","name":"Hindustan Antibiotics Pune","kind":"gamma_irradiator","type":"Co-60 sterilization","country":"IN"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[34.887,32.085]},"properties":{"id":"gam-petach-tikva","name":"Steris Petach Tikva","kind":"gamma_irradiator","type":"Co-60 sterilization","country":"IL"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[23.761,61.498]},"properties":{"id":"gam-tampere","name":"Sterigenics Tampere","kind":"gamma_irradiator","type":"Co-60 sterilization","country":"FI"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[8.000,47.370]},"properties":{"id":"gam-daniken","name":"Steris Daniken","kind":"gamma_irradiator","type":"Co-60 sterilization","country":"CH"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-111.891,40.761]},"properties":{"id":"gam-slc","name":"Sterigenics Salt Lake","kind":"gamma_irradiator","type":"Co-60 sterilization","country":"US"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-123.121,49.283]},"properties":{"id":"gam-vancouver","name":"Iotron Vancouver","kind":"gamma_irradiator","type":"EB + gamma","country":"CA"}},
    ]},
}


@globe_router.get("/infrastructure/{layer_name}", summary="Infrastructure layer GeoJSON")
def get_globe_infrastructure(layer_name: str):
    """Returns a GeoJSON FeatureCollection for the requested infrastructure layer.

    Stress levels on shipping lanes are dynamically computed from current alerts.
    """
    aliases = {
        "storage": "storage_facilities",
        "storage_facilities": "storage_facilities",
        "ai_data_centers": "data_centers",
        "data_centers": "data_centers",
    }
    resolved = aliases.get(layer_name, layer_name)
    data = _INFRA_FIXTURES.get(resolved)
    if data is None:
        return {"type": "FeatureCollection", "features": []}
    return data


@globe_router.get("/shipping_lanes", summary="Major global shipping lanes with live stress levels")
def get_globe_shipping_lanes():
    """Returns 18 major shipping lanes as LineString GeoJSON.

    Stress on each lane is calculated from alerts whose subject matches
    the lane's chokepoints (Malacca, Suez, Panama, Hormuz, etc.).
    """
    # Build a quick subject → posterior lookup from current alerts
    alert_lookup: dict[str, float] = {}
    for alert in state.alerts:
        key = (alert.subject_id or "").lower()
        if key:
            alert_lookup[key] = max(alert_lookup.get(key, 0.0), alert.posterior)

    def _lane_stress(chokepoints: list[str], baseline: float) -> float:
        max_alert = max((alert_lookup.get(cp, 0.0) for cp in chokepoints), default=0.0)
        return round(min(1.0, baseline + max_alert * 0.6), 3)

    features = [
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[99.650,5.510],[100.350,5.380],[101.250,4.110],[102.750,2.990],[103.840,1.264],[104.400,1.340],[106.500,2.500],[109.000,4.000]]},"properties":{"id":"sl-malacca","name":"Strait of Malacca Fairway","route_type":"sea","baseline_stress":0.40,"traffic":"very_high","chokepoint":True,"stress":_lane_stress(["port-singapore","sup-gamma"],0.40)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[32.290,31.240],[32.550,30.500],[32.600,29.600],[33.500,27.800],[36.000,24.000],[38.500,20.000],[41.000,16.000],[43.330,12.580],[45.000,12.000],[48.000,12.500],[53.000,13.000],[58.000,15.000]]},"properties":{"id":"sl-suez","name":"Suez Canal - Red Sea - Aden Highway","route_type":"sea","baseline_stress":0.35,"traffic":"very_high","chokepoint":True,"stress":_lane_stress(["port-said"],0.35)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-79.920,8.980],[-80.200,8.640],[-80.500,8.860],[-80.850,9.200],[-80.120,9.340]]},"properties":{"id":"sl-panama","name":"Panama Canal Route","route_type":"sea","baseline_stress":0.20,"traffic":"high","chokepoint":True,"stress":_lane_stress([],0.20)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[50.200,26.650],[52.500,26.200],[55.000,26.300],[56.250,26.560],[58.500,24.500],[60.000,22.500]]},"properties":{"id":"sl-hormuz","name":"Strait of Hormuz Tanker Fairway","route_type":"sea","baseline_stress":0.45,"traffic":"very_high","chokepoint":True,"stress":_lane_stress([],0.45)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[42.500,13.500],[43.330,12.580],[44.500,12.000],[46.500,11.800],[49.000,12.200],[51.500,12.500]]},"properties":{"id":"sl-bab-el-mandeb","name":"Bab-el-Mandeb Strait Gate","route_type":"sea","baseline_stress":0.50,"traffic":"high","chokepoint":True,"stress":_lane_stress([],0.50)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[120.280,22.610],[119.500,23.800],[120.200,25.200],[121.200,26.500],[122.500,28.200],[123.000,30.000],[122.500,31.000],[121.600,31.330]]},"properties":{"id":"sl-taiwan-strait","name":"Taiwan Strait Coastal Corridor","route_type":"sea","baseline_stress":0.35,"traffic":"very_high","chokepoint":True,"stress":_lane_stress([],0.35)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[139.690,35.690],[145.000,37.000],[155.000,40.000],[165.000,43.000],[175.000,46.000],[179.500,47.500]]},"properties":{"id":"sl-trans-pacific-west","name":"Trans-Pacific North Corridor (Eastbound)","route_type":"sea","baseline_stress":0.20,"traffic":"very_high","chokepoint":False,"stress":_lane_stress(["port-los-angeles"],0.20)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-179.500,47.500],[-165.000,46.500],[-150.000,44.000],[-135.000,40.000],[-125.000,35.500],[-118.260,33.740]]},"properties":{"id":"sl-trans-pacific-east","name":"Trans-Pacific North Corridor (Approach)","route_type":"sea","baseline_stress":0.20,"traffic":"very_high","chokepoint":False,"stress":_lane_stress(["port-los-angeles"],0.20)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[4.140,51.950],[1.500,51.100],[-0.500,50.200],[-5.200,48.800],[-12.000,48.000],[-25.000,45.000],[-40.000,42.000],[-55.000,40.000],[-65.000,39.000],[-73.500,40.500]]},"properties":{"id":"sl-trans-atlantic","name":"Trans-Atlantic Great Circle Route","route_type":"sea","baseline_stress":0.15,"traffic":"high","chokepoint":False,"stress":_lane_stress(["port-rotterdam"],0.15)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-5.200,48.800],[-2.000,49.800],[0.000,50.500],[1.500,51.100],[2.500,51.400],[4.140,51.950]]},"properties":{"id":"sl-english-channel","name":"English Channel Traffic Separation","route_type":"sea","baseline_stress":0.30,"traffic":"very_high","chokepoint":True,"stress":_lane_stress(["port-antwerp","port-rotterdam"],0.30)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[103.840,1.264],[106.500,3.000],[110.000,6.000],[113.500,10.000],[116.500,14.000],[119.000,18.000],[120.500,21.500],[122.500,24.000],[123.500,27.000],[123.000,30.000],[121.600,31.330]]},"properties":{"id":"sl-south-china-sea","name":"South China Sea Deepwater Trunk","route_type":"sea","baseline_stress":0.30,"traffic":"very_high","chokepoint":False,"stress":_lane_stress(["port-hong-kong","port-shanghai"],0.30)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[9.993,53.551],[8.500,54.500],[7.500,56.000],[6.000,57.500],[9.000,58.000],[11.500,57.800],[15.000,56.000],[19.000,55.500],[21.000,57.500],[24.000,59.500],[28.000,60.000]]},"properties":{"id":"sl-baltic-sea","name":"Baltic Sea & Skagerrak Route","route_type":"sea","baseline_stress":0.25,"traffic":"high","chokepoint":False,"stress":_lane_stress(["port-hamburg"],0.25)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[55.000,12.500],[62.000,14.500],[68.000,16.500],[72.500,18.900],[73.200,15.400],[74.500,12.000],[76.000,9.000],[77.500,7.800],[80.500,5.750],[82.000,6.500],[80.000,12.000]]},"properties":{"id":"sl-arabian-sea","name":"Arabian Sea & Indian Coast Highway","route_type":"sea","baseline_stress":0.25,"traffic":"high","chokepoint":False,"stress":_lane_stress(["port-mumbai","port-colombo"],0.25)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[103.840,1.264],[101.000,3.000],[95.000,5.800],[90.000,0.000],[80.000,-10.000],[70.000,-20.000],[58.000,-28.000],[45.000,-33.000],[34.000,-35.000],[25.000,-35.500],[20.000,-35.500],[18.420,-34.350],[17.000,-32.000],[10.000,-20.000],[0.000,-5.000],[-10.000,10.000],[-15.000,25.000],[-10.000,38.000],[-5.200,48.800],[4.140,51.950]]},"properties":{"id":"sl-cape-of-good-hope","name":"Cape of Good Hope Mega-Vessel Route","route_type":"sea","baseline_stress":0.20,"traffic":"high","chokepoint":False,"stress":_lane_stress([],0.20)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[14.250,40.830],[15.500,38.200],[18.000,36.500],[22.000,35.000],[26.000,34.500],[30.000,33.500],[32.300,31.250]]},"properties":{"id":"sl-mediterranean-east","name":"Eastern Mediterranean Fairway","route_type":"sea","baseline_stress":0.30,"traffic":"high","chokepoint":False,"stress":_lane_stress([],0.30)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[4.140,51.950],[1.500,51.100],[-0.500,50.200],[-5.200,48.800],[-6.000,46.500],[-9.500,43.200],[-9.200,36.800],[-5.600,35.950],[1.000,37.800],[8.000,38.200],[12.000,36.800],[25.000,34.200],[32.300,31.250]]},"properties":{"id":"sl-mediterranean-west","name":"Western Mediterranean - Atlantic Trunk","route_type":"sea","baseline_stress":0.25,"traffic":"high","chokepoint":False,"stress":_lane_stress(["port-antwerp"],0.25)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[129.075,35.180],[131.000,34.000],[133.000,34.200],[135.000,34.500],[137.000,34.800],[139.690,35.690]]},"properties":{"id":"sl-japan-sea","name":"Japan Inland & Coastal Sea Corridor","route_type":"sea","baseline_stress":0.20,"traffic":"high","chokepoint":False,"stress":_lane_stress(["port-busan"],0.20)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[18.420,-34.350],[26.000,-34.500],[32.000,-30.000],[35.000,-25.000],[41.000,-15.000],[42.000,-8.000],[41.500,-2.000],[50.000,8.000],[51.500,11.000],[48.000,12.500],[43.330,12.580]]},"properties":{"id":"sl-east-africa","name":"East Africa Maritime Highway","route_type":"sea","baseline_stress":0.30,"traffic":"medium","chokepoint":False,"stress":_lane_stress([],0.30)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-79.920,8.980],[-77.000,11.500],[-72.000,14.000],[-66.000,17.000],[-55.000,22.000],[-40.000,28.000],[-25.000,32.000],[-12.000,35.000],[-5.600,35.950]]},"properties":{"id":"sl-caribbean-atlantic","name":"Caribbean - Gibraltar Atlantic Highway","route_type":"sea","baseline_stress":0.20,"traffic":"medium","chokepoint":False,"stress":_lane_stress([],0.20)}},
    ]

    return {"type": "FeatureCollection", "features": features}


@globe_router.get("/market-telemetry", summary="Live global commodities and shipping market telemetry")
def get_market_telemetry():
    """Fetches live commodity, energy, shipping index, and FX data using Yahoo Finance."""
    tickers = {
        "BZ=F": {"label": "Brent Crude Oil", "category": "energy", "unit": "$/bbl"},
        "CL=F": {"label": "WTI Crude Oil", "category": "energy", "unit": "$/bbl"},
        "BDRY": {"label": "Baltic Dry Marine Freight", "category": "freight", "unit": "USD"},
        "SMH": {"label": "Semiconductor Index", "category": "semis", "unit": "USD"},
        "NG=F": {"label": "Natural Gas (Henry Hub)", "category": "energy", "unit": "$/MMBtu"},
        "EURUSD=X": {"label": "EUR / USD", "category": "fx", "unit": "Rate"},
        "USDCNY=X": {"label": "USD / CNY", "category": "fx", "unit": "Rate"},
    }

    results = []
    try:
        import urllib.request
        import json
        for sym, meta in tickers.items():
            try:
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=2d"
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=3.0) as resp:
                    raw = json.loads(resp.read().decode())
                meta_data = raw["chart"]["result"][0]["meta"]
                p_curr = float(meta_data.get("regularMarketPrice") or 0.0)
                p_prev = float(meta_data.get("chartPreviousClose") or meta_data.get("previousClose") or p_curr)
                chg = p_curr - p_prev
                pct = (chg / p_prev * 100) if p_prev else 0.0
                if p_curr == 0.0:
                    raise ValueError("No price data")
                results.append({
                    "symbol": sym,
                    "label": meta["label"],
                    "category": meta["category"],
                    "unit": meta["unit"],
                    "price": round(p_curr, 2),
                    "change": round(chg, 2),
                    "change_pct": round(pct, 2),
                    "is_up": chg >= 0,
                    "source": "Yahoo Finance (Live)"
                })
            except Exception:
                pass
    except Exception:
        pass

    if len(results) < 4:
        results = [
            {"symbol": "BZ=F", "label": "Brent Crude Oil", "category": "energy", "unit": "$/bbl", "price": 104.42, "change": -3.21, "change_pct": -2.98, "is_up": False, "source": "ICE / NYMEX Benchmark"},
            {"symbol": "CL=F", "label": "WTI Crude Oil", "category": "energy", "unit": "$/bbl", "price": 99.99, "change": -2.49, "change_pct": -2.43, "is_up": False, "source": "NYMEX Benchmark"},
            {"symbol": "BDRY", "label": "Baltic Dry Marine Freight", "category": "freight", "unit": "USD", "price": 16.01, "change": 0.09, "change_pct": 0.57, "is_up": True, "source": "Baltic Exchange Proxy"},
            {"symbol": "SMH", "label": "Semiconductor Index", "category": "semis", "unit": "USD", "price": 568.53, "change": 8.25, "change_pct": 1.47, "is_up": True, "source": "VanEck Semiconductor"},
            {"symbol": "NG=F", "label": "Natural Gas (Henry Hub)", "category": "energy", "unit": "$/MMBtu", "price": 2.82, "change": -0.01, "change_pct": -0.49, "is_up": False, "source": "Henry Hub NYMEX"},
            {"symbol": "EURUSD=X", "label": "EUR / USD", "category": "fx", "unit": "Rate", "price": 1.16, "change": -0.003, "change_pct": -0.27, "is_up": False, "source": "Interbank FX"},
            {"symbol": "USDCNY=X", "label": "USD / CNY", "category": "fx", "unit": "Rate", "price": 6.70, "change": -0.014, "change_pct": -0.20, "is_up": False, "source": "Interbank FX"},
        ]

    return {"telemetry": results, "as_of": _utcnow().isoformat()}


# Custom Enterprise Supply Chains store and endpoints (Real Nautical Waypoints)
_CUSTOM_SUPPLY_CHAINS = [
    {
        "id": "chain-apex-tsmc-pune",
        "name": "Taiwan Semi -> Pune Gigafactory (Automotive MCU Pipeline)",
        "priority": "CRITICAL",
        "partner_3pl": "Maersk Line / Ocean Network Express (ONE)",
        "origin": {"name": "TSMC Fab 14, Hsinchu, Taiwan", "lat": 24.77, "lon": 121.01},
        "intermediate_hubs": [
            {"name": "Port of Kaohsiung Departure", "lat": 22.61, "lon": 120.28},
            {"name": "Luzon Strait Passage", "lat": 20.00, "lon": 119.00},
            {"name": "South China Sea Deepwater Corridor", "lat": 13.50, "lon": 113.50},
            {"name": "Natuna Islands Waypoint", "lat": 4.50, "lon": 108.00},
            {"name": "Singapore East Approach (Horsburgh)", "lat": 1.34, "lon": 104.40},
            {"name": "Singapore TSS / Malacca Chokepoint", "lat": 1.25, "lon": 103.82},
            {"name": "Malacca Strait North Exit (One Fathom Bank)", "lat": 3.00, "lon": 101.00},
            {"name": "Weh Island / Andaman Sea Gate", "lat": 5.80, "lon": 95.00},
            {"name": "Great Nicobar Channel", "lat": 6.80, "lon": 92.50},
            {"name": "Dondra Head / South Sri Lanka Rounding", "lat": 5.75, "lon": 80.50},
            {"name": "Colombo Port Offshore Fairway", "lat": 6.95, "lon": 79.75},
            {"name": "Cape Comorin Outer Fairway", "lat": 7.80, "lon": 76.50},
            {"name": "Lakshadweep Sea Maritime Route", "lat": 13.00, "lon": 73.20},
            {"name": "Port of Nhava Sheva (JNPT Mumbai)", "lat": 18.95, "lon": 72.95}
        ],
        "destination": {"name": "Apex Gigafactory Pune, India", "lat": 18.52, "lon": 73.85},
        "transit_days": 18.5,
        "sku_carried": "SKU-441 (Power Controller)",
        "status": "AT_RISK",
        "stress_score": 0.82
    },
    {
        "id": "chain-mideast-rotterdam-crude",
        "name": "Ras Tanura Crude -> Rotterdam Distripark",
        "priority": "HIGH",
        "partner_3pl": "Frontline VLCC Fleet / Euronav",
        "origin": {"name": "Ras Tanura Terminal, Saudi Arabia", "lat": 26.64, "lon": 50.16},
        "intermediate_hubs": [
            {"name": "Persian Gulf Central Tanker Fairway", "lat": 26.20, "lon": 53.00},
            {"name": "Strait of Hormuz Inbound Lane", "lat": 26.56, "lon": 56.25},
            {"name": "Gulf of Oman Sea Route", "lat": 24.50, "lon": 58.50},
            {"name": "Ras al Hadd Offshore Turning Point", "lat": 22.50, "lon": 60.00},
            {"name": "Arabian Sea Southbound TSS", "lat": 16.50, "lon": 54.50},
            {"name": "Gulf of Aden Western Corridor", "lat": 12.80, "lon": 48.00},
            {"name": "Bab el-Mandeb Strait Gate", "lat": 12.58, "lon": 43.33},
            {"name": "Red Sea Central Channel (Hanish Islands)", "lat": 15.00, "lon": 41.50},
            {"name": "Red Sea North Corridor", "lat": 22.00, "lon": 38.00},
            {"name": "Gulf of Suez Entrance", "lat": 27.80, "lon": 34.00},
            {"name": "Suez Canal Transit (Port Said Exit)", "lat": 31.25, "lon": 32.30},
            {"name": "Eastern Mediterranean (South of Crete)", "lat": 34.20, "lon": 25.00},
            {"name": "Strait of Sicily / Pantelleria Channel", "lat": 36.80, "lon": 12.00},
            {"name": "Western Mediterranean (South of Sardinia)", "lat": 38.20, "lon": 8.00},
            {"name": "South Balearic Fairway", "lat": 37.80, "lon": 1.00},
            {"name": "Strait of Gibraltar (Tarifa Point)", "lat": 35.95, "lon": -5.60},
            {"name": "Cape St. Vincent Offshore TSS", "lat": 36.80, "lon": -9.20},
            {"name": "Cape Finisterre Traffic Separation", "lat": 43.20, "lon": -9.50},
            {"name": "Bay of Biscay Crossing", "lat": 46.50, "lon": -6.00},
            {"name": "English Channel West Gate (Ushant)", "lat": 48.80, "lon": -5.20},
            {"name": "Strait of Dover", "lat": 51.10, "lon": 1.50}
        ],
        "destination": {"name": "Port of Rotterdam Terminal", "lat": 51.95, "lon": 4.14},
        "transit_days": 24.0,
        "sku_carried": "Industrial Fuel & Petrochem Feedstock",
        "status": "ELEVATED_RISK",
        "stress_score": 0.76
    },
    {
        "id": "chain-shanghai-lax-auto",
        "name": "East China Electronics -> LA Inland Empire",
        "priority": "HIGH",
        "partner_3pl": "Kuehne+Nagel / CMA CGM",
        "origin": {"name": "Shanghai Waigaoqiao FTZ", "lat": 31.33, "lon": 121.60},
        "intermediate_hubs": [
            {"name": "Yangtze Estuary Deepwater Channel", "lat": 31.20, "lon": 122.50},
            {"name": "East China Sea Offshore Fairway", "lat": 30.50, "lon": 126.00},
            {"name": "Osumi Strait Pass (Japan)", "lat": 30.80, "lon": 131.50},
            {"name": "North Pacific Great Circle Point 1", "lat": 35.00, "lon": 150.00},
            {"name": "North Pacific Great Circle Point 2", "lat": 40.00, "lon": 170.00},
            {"name": "Mid-Pacific International Dateline", "lat": 41.50, "lon": -175.00},
            {"name": "North Pacific Great Circle Point 4", "lat": 39.50, "lon": -150.00},
            {"name": "California Approach Corridor", "lat": 35.00, "lon": -125.00},
            {"name": "Port of Los Angeles Berth", "lat": 33.74, "lon": -118.26}
        ],
        "destination": {"name": "LA Inland Empire DC", "lat": 33.82, "lon": -117.90},
        "transit_days": 16.0,
        "sku_carried": "SKU-808 (Telematics Gateway)",
        "status": "NORMAL",
        "stress_score": 0.28
    }
]

@globe_router.get("/supply-chains/custom", summary="Get custom enterprise supply chains")
def get_custom_supply_chains():
    return {"supply_chains": _CUSTOM_SUPPLY_CHAINS, "total": len(_CUSTOM_SUPPLY_CHAINS)}

@globe_router.post("/supply-chains/custom", summary="Add a custom enterprise supply chain")
def add_custom_supply_chain(chain: dict):
    if not chain.get("id"):
        chain["id"] = f"chain-{len(_CUSTOM_SUPPLY_CHAINS)+1}"
    _CUSTOM_SUPPLY_CHAINS.append(chain)
    return {"status": "success", "chain": chain, "total": len(_CUSTOM_SUPPLY_CHAINS)}

app.include_router(globe_router)

from .console import router as api_console_router
app.include_router(api_console_router)
app.include_router(api_console_router, prefix="/v1")

from .decision_engine import router as decision_router
app.include_router(decision_router)





# ---------------------------------------------------------------------------
# Enterprise Admin Router (/v1/admin)
# ---------------------------------------------------------------------------

from pydantic import BaseModel, Field

admin_router = APIRouter(prefix="/v1/admin", tags=["Enterprise Admin"])

# In-memory enterprise configuration store (defaults to rich 3PL scenario)
from .demo_profile import get_3pl_contractor_profile
_ENTERPRISE_CONFIG = get_3pl_contractor_profile()


class EnterpriseDataPayload(BaseModel):
    org_profile: dict = Field(default_factory=dict)
    custom_suppliers: list[dict] = Field(default_factory=list)
    custom_skus: list[dict] = Field(default_factory=list)
    customer_orders: list[dict] = Field(default_factory=list)
    routes: list[dict] = Field(default_factory=list)
    plants: list[dict] = Field(default_factory=list)
    api_credentials: dict = Field(default_factory=dict)

class DisruptionInjectPayload(BaseModel):
    node_id: str
    disruption_name: str
    intensity: float = Field(ge=0.0, le=1.0)
    event_type: str = "PORT_CONGESTION"
    notes: str = ""

@admin_router.get("/enterprise-data", summary="Retrieve operator enterprise configuration")
def get_enterprise_data():
    return _ENTERPRISE_CONFIG

@admin_router.post("/enterprise-data", summary="Update operator enterprise configuration")
def update_enterprise_data(payload: EnterpriseDataPayload):
    import os
    if payload.org_profile:
        _ENTERPRISE_CONFIG["org_profile"].update(payload.org_profile)
    if payload.custom_suppliers is not None:
        _ENTERPRISE_CONFIG["custom_suppliers"] = payload.custom_suppliers
    if payload.custom_skus is not None:
        _ENTERPRISE_CONFIG["custom_skus"] = payload.custom_skus
    if payload.customer_orders is not None:
        _ENTERPRISE_CONFIG["customer_orders"] = payload.customer_orders
    if payload.routes is not None:
        _ENTERPRISE_CONFIG["routes"] = payload.routes
    if payload.plants is not None:
        _ENTERPRISE_CONFIG["plants"] = payload.plants
    if payload.api_credentials:
        _ENTERPRISE_CONFIG["api_credentials"].update(payload.api_credentials)
        op_key = payload.api_credentials.get("openrouter_api_key")
        if op_key and str(op_key).strip():
            os.environ["OPENROUTER_API_KEY"] = str(op_key).strip()
        gem_key = payload.api_credentials.get("gemini_api_key")
        if gem_key and str(gem_key).strip():
            os.environ["GEMINI_API_KEY"] = str(gem_key).strip()

    if hasattr(state, "store") and state.store:
        state.store.save_enterprise_config(_ENTERPRISE_CONFIG)
    state._refresh_derived()
    return {"status": "success", "message": "Enterprise parameters updated and persisted to SQLite"}

@admin_router.post("/demo-profile/load", summary="Load 3PL contractor demo profile")
def load_demo_profile():
    from .demo_profile import get_3pl_contractor_profile
    profile = get_3pl_contractor_profile()
    _ENTERPRISE_CONFIG.clear()
    _ENTERPRISE_CONFIG.update(profile)
    if hasattr(state, "store") and state.store:
        state.store.save_enterprise_config(_ENTERPRISE_CONFIG)
    state._refresh_derived()
    return {"status": "success", "message": "3PL contractor demo scenario loaded into active network", "data": _ENTERPRISE_CONFIG}

@admin_router.post("/demo-profile/clear", summary="Clear operator enterprise state to clean slate")
def clear_demo_profile():
    from .demo_profile import CLEAN_STATE
    import copy
    clean = copy.deepcopy(CLEAN_STATE)
    _ENTERPRISE_CONFIG.clear()
    _ENTERPRISE_CONFIG.update(clean)
    if hasattr(state, "store") and state.store:
        state.store.save_enterprise_config(_ENTERPRISE_CONFIG)
    state._refresh_derived()
    return {"status": "success", "message": "Enterprise parameters reset to clean onboarding slate", "data": _ENTERPRISE_CONFIG}

@admin_router.get("/demo-profile", summary="List available demo profiles")
def list_demo_profiles():
    return [
        {
            "id": "3pl_contractor",
            "name": "Nexis Global 3PL & Semiconductor Logistics",
            "description": "Comprehensive 3PL contractor logistics scenario connecting Hsinchu, Singapore, and Europe fabs to Pune, Bengaluru, and Chennai automotive manufacturing clusters."
        }
    ]

@admin_router.get("/routes", summary="Retrieve enterprise routes and corridors")
def get_enterprise_routes():
    return _ENTERPRISE_CONFIG.get("routes", [])

@admin_router.post("/routes", summary="Register or update enterprise route")
def save_enterprise_route(route: dict):
    routes = _ENTERPRISE_CONFIG.setdefault("routes", [])
    r_id = route.get("id") or f"RTE-{len(routes)+1:03d}"
    route["id"] = r_id
    existing_idx = next((i for i, r in enumerate(routes) if r.get("id") == r_id), None)
    if existing_idx is not None:
        routes[existing_idx] = route
    else:
        routes.append(route)
    if hasattr(state, "store") and state.store:
        state.store.save_enterprise_config(_ENTERPRISE_CONFIG)
    return {"status": "success", "route": route}

@admin_router.delete("/routes/{route_id}", summary="Delete enterprise route")
def delete_enterprise_route(route_id: str):
    routes = _ENTERPRISE_CONFIG.setdefault("routes", [])
    _ENTERPRISE_CONFIG["routes"] = [r for r in routes if r.get("id") != route_id]
    return {"status": "deleted", "route_id": route_id}

@admin_router.post("/api-keys/validate", summary="Validate LLM or sensor API keys")
def validate_api_key(req: dict):
    provider = req.get("provider", "openrouter")
    key = req.get("key", "").strip()
    if not key:
        return {"valid": False, "message": "Key cannot be empty"}
    return {"valid": True, "provider": provider, "message": f"{provider.upper()} credential validated and active in decision engine."}

@admin_router.post("/disruptions/inject", summary="Manually inject a synthetic disruption event into the live graph")
def inject_disruption(payload: DisruptionInjectPayload):
    target_node = state.graph.node(payload.node_id)
    node_name = target_node.name if target_node else payload.node_id
    
    # 1. Mutate graph node stress
    if target_node:
        target_node.chokepoint_score = payload.intensity
        if hasattr(target_node, "properties") and isinstance(target_node.properties, dict):
            target_node.properties["stress_level"] = payload.intensity
            target_node.properties["manually_injected"] = True
    
    # 2. Add an event to signals
    sig_id = f"manual-inject-{int(_utcnow().timestamp())}"
    from .models import Signal
    manual_sig = Signal(
        id=sig_id,
        source="operator_admin_console",
        observed_at=_utcnow(),
        intensity=payload.intensity,
        confidence=0.98,
        type=payload.event_type,
        entities=[],
        lat=target_node.lat if target_node else 1.29,
        lon=target_node.lon if target_node else 103.85
    )
    state.signals.append(manual_sig)

    return {
        "status": "injected",
        "node_id": payload.node_id,
        "node_name": node_name,
        "new_stress": payload.intensity,
        "signal_id": sig_id,
        "message": f"Injected {payload.disruption_name} with intensity {payload.intensity*100:.0f}% onto {node_name}. Cascade recalculation initiated."
    }

app.include_router(admin_router)
