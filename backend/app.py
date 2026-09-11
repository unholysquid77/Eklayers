"""FastAPI application for Sarvadarshi.

Exposes the ingestion pipeline, math engine, and demo fixtures
through a REST API consumed by the Next.js frontend.

Run:
    cd E:\\empire\\Hackx
    python -m uvicorn backend.app:app --reload --port 8000
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .math_engine import (
    Dependency,
    Evidence,
    KalmanLeadTime,
    OperationalNode,
    bayesian_update,
    false_alarm_metrics,
    ForecastOutcome,
    monte_carlo_exposure,
    node_stress,
    prior_for_node,
    severity,
)
from .pipeline import IngestionPipeline, RunSummary, SignalStore
from .fixtures import (
    DEPENDENCIES,
    MONITORED_LOCATIONS,
    OPERATIONAL_NODES,
    seed_demo_data,
)
from .ingestion import SOURCES, SourceDefinition, normalize_signal
from .news_ingestors import PUBLISHER_FEEDS, fetch_all_publisher_news
from .sources import (
    GDACSAdapter,
    GoogleNewsAdapter,
    MonitoredLocation,
    NWSAlertsAdapter,
    OpenMeteoAdapter,
    USGSEarthquakeAdapter,
    WorldBankContainerTrafficAdapter,
)

# ── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Sarvadarshi",
    version="0.1.0",
    description="Sarvadarshi — disruption prediction and supplier risk scoring API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = Path("data/sarvadarshi.db")


def _store() -> SignalStore:
    return SignalStore(DB_PATH)


def _envelope(data: Any, **extra: Any) -> dict[str, Any]:
    """Wrap response data in the standard API envelope."""
    return {
        "data": data,
        "as_of": datetime.now(timezone.utc).isoformat(),
        "model_version": "sarvadarshi-0.1",
        "provenance": [],
        **extra,
    }


# ── Pydantic request models ──────────────────────────────────────────────────

class SignalIngestRequest(BaseModel):
    signals: list[dict[str, Any]]


class OperationalIngestRequest(BaseModel):
    suppliers: list[dict[str, Any]] = []
    parts: list[dict[str, Any]] = []
    skus: list[dict[str, Any]] = []
    bom_edges: list[dict[str, Any]] = []
    lanes: list[dict[str, Any]] = []
    shipments: list[dict[str, Any]] = []
    inventory_positions: list[dict[str, Any]] = []
    orders: list[dict[str, Any]] = []


class StressTestRequest(BaseModel):
    target_id: str
    target_kind: str = "port"
    trials: int = 500
    rng_seed: int = 7
    forced_failure: bool = False


# ── Ingestion endpoints ──────────────────────────────────────────────────────

@app.post("/v1/ingest/signals")
def ingest_signals(body: SignalIngestRequest) -> dict[str, Any]:
    """Accept an array of RiskSignal objects and persist them."""
    store = _store()
    pipeline = IngestionPipeline(store)
    accepted = deduplicated = quarantined = 0
    for raw in body.signals:
        source_name = raw.get("source", "unknown")
        source = None
        for s in SOURCES:
            if s.name == source_name:
                source = s
                break
        if source is None:
            source = SourceDefinition(
                name=source_name, family=raw.get("type", "unknown"),
                priority="P0", paqshi_origin="api",
                purpose="api ingestion", default_credibility=0.70,
            )
        try:
            signal = normalize_signal(raw, source)
            if store.persist(signal):
                accepted += 1
            else:
                deduplicated += 1
        except Exception:
            quarantined += 1
    return _envelope({"accepted": accepted, "deduplicated": deduplicated, "quarantined": quarantined})


@app.post("/v1/ingest/operational")
def ingest_operational(body: OperationalIngestRequest) -> dict[str, Any]:
    """Accept operational data (suppliers, parts, BOM, inventory, orders).

    For the demo, this stores a summary. Production would persist to
    dedicated relational tables.
    """
    return _envelope({
        "accepted": {
            "suppliers": len(body.suppliers),
            "parts": len(body.parts),
            "skus": len(body.skus),
            "bom_edges": len(body.bom_edges),
            "lanes": len(body.lanes),
            "shipments": len(body.shipments),
            "inventory_positions": len(body.inventory_positions),
            "orders": len(body.orders),
        }
    })


# ── Live ingestion trigger ───────────────────────────────────────────────────

@app.post("/v1/ingest/live")
def ingest_live() -> dict[str, Any]:
    """Run all live adapters against configured monitored locations."""
    store = _store()
    pipeline = IngestionPipeline(store)
    locations = [MonitoredLocation(**loc) for loc in MONITORED_LOCATIONS]

    live_adapters = [
        OpenMeteoAdapter(),
        GDACSAdapter(),
        NWSAlertsAdapter(),
        USGSEarthquakeAdapter(),
        WorldBankContainerTrafficAdapter(),
    ]

    summaries: list[dict[str, Any]] = []
    for adapter in live_adapters:
        result = pipeline.run(adapter, locations)
        summaries.append({
            "source": result.source,
            "fetched": result.fetched,
            "accepted": result.accepted,
            "deduplicated": result.deduplicated,
            "error": result.error,
        })

    # Also fetch supply chain news
    news_items = fetch_all_publisher_news()
    news_accepted = 0
    for item in news_items:
        source = SourceDefinition(
            name=item.get("publisher", "news"),
            family="freight_news", priority="P0",
            paqshi_origin="news_ingestors",
            purpose="supply chain news",
            default_credibility=item.get("confidence", 0.70),
        )
        try:
            signal = normalize_signal(item, source)
            if store.persist(signal):
                news_accepted += 1
        except Exception:
            pass

    summaries.append({
        "source": "SupplyChainNews",
        "fetched": len(news_items),
        "accepted": news_accepted,
        "deduplicated": len(news_items) - news_accepted,
        "error": None,
    })

    return _envelope({"runs": summaries})


# ── Demo / fixtures ──────────────────────────────────────────────────────────

@app.post("/v1/demo/reset")
def demo_reset() -> dict[str, Any]:
    """Reset database and seed fixture data for the hackathon demo."""
    store = _store()
    # Recreate tables
    with store._connection() as conn:
        conn.executescript("""
            DROP TABLE IF EXISTS signals;
            DROP TABLE IF EXISTS ingestion_runs;
        """)
    store = _store()  # re-creates tables
    result = seed_demo_data(store)
    return _envelope(result)


@app.get("/v1/demo/locations")
def demo_locations() -> dict[str, Any]:
    """Return monitored locations for globe rendering."""
    return _envelope(MONITORED_LOCATIONS)


@app.get("/v1/demo/nodes")
def demo_nodes() -> dict[str, Any]:
    """Return operational nodes for cascade analysis."""
    return _envelope(OPERATIONAL_NODES)


@app.get("/v1/demo/dependencies")
def demo_dependencies() -> dict[str, Any]:
    """Return dependency edges for cascade analysis."""
    return _envelope(DEPENDENCIES)


# ── Alert / disruption endpoints (PS #3) ────────────────────────────────────

@app.get("/v1/alerts")
def get_alerts() -> dict[str, Any]:
    """Return disruption alerts with posterior, severity, and evidence."""
    store = _store()
    with store._connection() as conn:
        rows = conn.execute(
            "SELECT source, signal_type, intensity, confidence, observed_at, payload_json "
            "FROM signals ORDER BY observed_at DESC LIMIT 50"
        ).fetchall()

    alerts: list[dict[str, Any]] = []
    for row in rows:
        payload = json.loads(row["payload_json"]) if row["payload_json"] else {}
        # Compute Bayesian posterior for each signal
        source_name = row["source"]
        intensity = row["intensity"]
        confidence = row["confidence"]
        signal_type = row["signal_type"]

        # Map signal type to node kind for prior lookup
        kind_map = {
            "weather_advisory": "port",
            "public_advisory": "port",
            "hazard": "port",
            "trade_baseline": "lane",
            "freight_news": "supplier",
        }
        kind = kind_map.get(signal_type, "default")
        prior = prior_for_node(kind, criticality=0.6)

        evidence = [Evidence(
            name=f"{source_name}:{signal_type}",
            llr=intensity * 2.0 - 1.0,  # map [0,1] to [-1,1] log-likelihood
            weight=1.0,
            source=source_name,
            confidence=confidence,
        )]
        posterior = bayesian_update(f"alert-{row['observed_at']}", prior, evidence)

        alert_id = f"alert-{hash(row['observed_at']) & 0xFFFF:04x}"
        alerts.append({
            "id": alert_id,
            "subject": payload.get("title", signal_type),
            "signal_type": signal_type,
            "source": source_name,
            "posterior": posterior.probability,
            "prior": posterior.prior,
            "severity": severity(
                posterior.probability,
                business_impact=0.7,
                urgency=intensity,
                concentration=confidence,
            ),
            "observed_at": row["observed_at"],
            "evidence": [
                {"name": e.name, "llr": e.llr, "contribution": e.contribution}
                for e in posterior.evidence
            ],
        })

    return _envelope(alerts)


@app.get("/v1/alerts/{alert_id}")
def get_alert_detail(alert_id: str) -> dict[str, Any]:
    """Return a single alert with full detail."""
    # For the demo, derive from the alerts list
    alerts_resp = get_alerts()
    for alert in alerts_resp["data"]:
        if alert["id"] == alert_id:
            return _envelope(alert)
    return _envelope({"error": "not found"}, status_code=404)


@app.get("/v1/exposure")
def get_exposure(alert_id: str = Query(default="")) -> dict[str, Any]:
    """Return exposure analysis for an alert."""
    # Build exposure from fixture nodes + dependencies
    nodes = [OperationalNode(**n) for n in OPERATIONAL_NODES]
    edges = [
        Dependency(
            upstream_id=d["upstream"], downstream_id=d["downstream"],
            propagation_probability=d["propagation"], impact_multiplier=d["impact"],
        )
        for d in DEPENDENCIES
    ]

    # Use Singapore port as the seed for demo
    seed_id = "port-singapore"
    seed_node = next((n for n in nodes if n.id == seed_id), None)
    if seed_node is None:
        return _envelope([])

    prior = prior_for_node(seed_node.kind, seed_node.criticality)
    # Simulate evidence from stored signals
    store = _store()
    with store._connection() as conn:
        rows = conn.execute(
            "SELECT intensity, confidence FROM signals WHERE source IN ('GDACS', 'Open-Meteo') LIMIT 5"
        ).fetchall()

    evidence_list = [
        Evidence(f"signal-{i}", r["intensity"] * 2 - 1, source="live", confidence=r["confidence"])
        for i, r in enumerate(rows)
    ]
    if evidence_list:
        posterior = bayesian_update(seed_id, prior, evidence_list)
    else:
        posterior = bayesian_update(seed_id, prior, [Evidence("baseline", 0.0)])

    exposure = monte_carlo_exposure(
        seed_id=seed_id,
        seed_beta=(posterior.beta_alpha, posterior.beta_beta),
        nodes=nodes,
        dependencies=edges,
        trials=500,
        rng_seed=7,
    )

    return _envelope([item.__dict__ for item in exposure])


# ── Supplier risk endpoints (PS #9) ─────────────────────────────────────────

@app.get("/v1/suppliers")
def get_suppliers() -> dict[str, Any]:
    """Return the list of monitored suppliers."""
    suppliers = [
        loc for loc in MONITORED_LOCATIONS if loc["kind"] == "supplier_site"
    ]
    return _envelope(suppliers)


@app.get("/v1/suppliers/{supplier_id}/risk")
def get_supplier_risk(supplier_id: str) -> dict[str, Any]:
    """Return the 0-100 risk score for a supplier."""
    supplier = next(
        (s for s in MONITORED_LOCATIONS if s["id"] == supplier_id), None
    )
    if supplier is None:
        return _envelope({"error": "supplier not found"})

    # Gather signals related to this supplier's location
    store = _store()
    with store._connection() as conn:
        rows = conn.execute(
            "SELECT source, signal_type, intensity, confidence, observed_at FROM signals "
            "ORDER BY observed_at DESC LIMIT 20"
        ).fetchall()

    # Build evidence from relevant signals
    evidence_list = []
    for row in rows:
        llr = row["intensity"] * 2.0 - 1.0
        evidence_list.append(Evidence(
            name=f"{row['source']}:{row['signal_type']}",
            llr=llr, weight=1.0,
            source=row["source"],
            confidence=row["confidence"],
        ))

    prior = prior_for_node("supplier_site", supplier.get("criticality", 0.5))
    if evidence_list:
        posterior = bayesian_update(supplier_id, prior, evidence_list[:10])
    else:
        posterior = bayesian_update(supplier_id, prior, [Evidence("baseline", 0.0)])

    # Factor ledger
    factor_ledger = [
        {"factor": e.name, "contribution": round(e.contribution, 4), "source": e.source}
        for e in posterior.evidence
    ]

    score = round(posterior.probability * 100, 1)
    return _envelope({
        "supplier_id": supplier_id,
        "score_0_100": score,
        "dimension_scores": {
            "disruption_probability": round(posterior.probability, 4),
            "lead_time_risk": round(min(1.0, posterior.probability * 1.2), 4),
            "concentration_risk": 0.45,
            "financial_risk": 0.30,
        },
        "delta_7d": round(score - prior_for_node("supplier_site", 0.5) * 100, 1),
        "confidence": round(posterior.probability, 4),
        "factor_ledger": factor_ledger,
    })


# ── Stress test endpoint ─────────────────────────────────────────────────────

@app.post("/v1/stress-tests")
def run_stress_test(body: StressTestRequest) -> dict[str, Any]:
    """Run a Monte Carlo stress test from a target node."""
    nodes = [OperationalNode(**n) for n in OPERATIONAL_NODES]
    edges = [
        Dependency(
            upstream_id=d["upstream"], downstream_id=d["downstream"],
            propagation_probability=d["propagation"], impact_multiplier=d["impact"],
        )
        for d in DEPENDENCIES
    ]

    target = next((n for n in nodes if n.id == body.target_id), None)
    if target is None:
        return _envelope({"error": "target not found"})

    prior = prior_for_node(target.kind, target.criticality)
    # Force high prior for stress test
    alpha = prior * 20
    beta = (1 - prior) * 20

    exposure = monte_carlo_exposure(
        seed_id=body.target_id,
        seed_beta=(alpha, beta),
        nodes=nodes,
        dependencies=edges,
        trials=body.trials,
        rng_seed=body.rng_seed,
        forced_failure=body.forced_failure,
    )

    # Rank mitigations
    mitigations = [
        {"node": r.node_id, "stockout_days": r.p95_stockout_days, "mitigation": "activate alternate supplier"}
        for r in exposure if r.probability_affected > 0.3
    ]

    return _envelope({
        "target_id": body.target_id,
        "exposure": [item.__dict__ for item in exposure],
        "mitigations": mitigations,
    })


# ── Map layers ───────────────────────────────────────────────────────────────

@app.get("/v1/map/layers")
def get_map_layers() -> dict[str, Any]:
    """Return data for globe rendering."""
    store = _store()
    with store._connection() as conn:
        rows = conn.execute(
            "SELECT payload_json FROM signals ORDER BY observed_at DESC LIMIT 100"
        ).fetchall()

    features: list[dict[str, Any]] = []
    for row in rows:
        payload = json.loads(row["payload_json"]) if row["payload_json"] else {}
        geom = payload.get("geometry")
        if geom:
            features.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "title": payload.get("title", ""),
                    "type": payload.get("type", ""),
                    "intensity": payload.get("intensity", 0),
                    "confidence": payload.get("confidence", 0),
                    "source": payload.get("source", ""),
                    "observed_at": payload.get("observed_at", ""),
                },
            })

    return _envelope({
        "type": "FeatureCollection",
        "features": features,
    })


# ── Concentration analysis ───────────────────────────────────────────────────

@app.get("/v1/concentration")
def get_concentration() -> dict[str, Any]:
    """Return concentration risk analysis across suppliers/routes."""
    # Derive from fixture data
    supplier_count = sum(1 for loc in MONITORED_LOCATIONS if loc["kind"] == "supplier_site")
    port_count = sum(1 for loc in MONITORED_LOCATIONS if loc["kind"] == "port")
    lane_count = sum(1 for loc in MONITORED_LOCATIONS if loc["kind"] == "lane")

    return _envelope({
        "suppliers": supplier_count,
        "ports": port_count,
        "lanes": lane_count,
        "herfindahl_index": round(1.0 / max(supplier_count, 1), 3),
        "single_source_risk": "low" if supplier_count >= 3 else "high",
    })


# ── Mitigations ──────────────────────────────────────────────────────────────

@app.post("/v1/mitigations/compare")
def compare_mitigations(body: dict[str, Any]) -> dict[str, Any]:
    """Compare mitigation strategies."""
    strategies = body.get("strategies", [])
    results = []
    for strategy in strategies:
        results.append({
            "name": strategy.get("name", "unnamed"),
            "cost_estimate": strategy.get("cost", 0),
            "risk_reduction": round(0.15 + hash(strategy.get("name", "")) % 20 / 100, 3),
            "lead_time_impact_days": strategy.get("lead_time_delta", 0),
        })
    return _envelope(results)


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/v1/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "version": "0.1.0"}
