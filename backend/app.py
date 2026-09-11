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
)
from .scoring import (
    compare_mitigations,
    run_alert_pipeline,
    run_stress_test,
    score_supplier,
)
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
        self.reset()

    def reset(self) -> None:
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

    kf = KalmanLeadTime(mean_days=14.0, variance=9.0, process_variance=1.5)
    forecast = kf.forecast(horizon_days, disruption_prob)

    return _envelope({
        "node_id": node_id,
        "node_kind": node.kind,
        "disruption_probability": disruption_prob,
        "forecast": forecast,
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

    for node_id, hop in downstream:
        node = state.graph.node(node_id)
        if not node:
            continue
        inv = state.inventory.get(node_id)
        decay = 0.85 ** hop
        exposures.append(Exposure(
            alert_id=alert_id,
            entity_type=node.kind,
            entity_id=node_id,
            hop=hop,
            probability=round(alert.posterior * decay, 4),
            expected_delay_days=round((alert.p50_days or 0.0) * (0.70 ** hop), 2),
            inventory_days_cover=inv.days_cover if inv else None,
            expected_loss=0.0,
            explanation=[
                f"Hop {hop} downstream from {alert.subject_id}",
                f"Propagation decay factor: 0.85^{hop} = {decay:.3f}",
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
    import random
    from datetime import datetime, timezone
    locations = [
        ("Singapore Port", 1.264, 103.840, "port-singapore"),
        ("Taiwan Strait", 24.3, 119.5, "port-kaohsiung"),
        ("Red Sea", 16.0, 41.0, "port-said"),
        ("Beta KK (Tokyo)", 35.6895, 139.6917, "sup-beta"),
    ]
    loc = random.choice(locations)
    signal = RiskSignal(
        id=f"sig-{random.randint(1000, 9999)}",
        type="geopolitical",
        source="cron-ingestor",
        subject=loc[3],
        body=f"Automated ingestion pipeline detected anomaly near {loc[0]}",
        severity=random.uniform(0.5, 0.9),
        lat=loc[1],
        lon=loc[2],
        geography=loc[0],
        entities=[loc[3]],
        observed_at=datetime.now(timezone.utc).isoformat()
    )
    state.signals.append(signal)
    state._refresh_derived()
    return _envelope({"status": "ok", "ingested": 1, "signal_id": signal.id})

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
    # 1. Chokepoints
    chokepoints = []
    for cp in state.graph.surface_chokepoints():
        chokepoints.append({
            "id": cp.id,
            "name": cp.name,
            "category": cp.kind,
            "latitude": cp.lat if cp.lat is not None else 0.0,
            "longitude": cp.lon if cp.lon is not None else 0.0,
            "stress_level": cp.chokepoint_score if cp.chokepoint_score is not None else 0.0,
            "baseline": 0.10,
            "criticality": cp.criticality if cp.criticality is not None else 0.5,
        })
    
    # 2. Events (from signals)
    events = []
    for idx, sig in enumerate(state.signals[-50:]):  # Limit to recent 50
        events.append({
            "id": sig.id or f"evt-{idx}",
            "latitude": sig.lat if sig.lat is not None else 0.0,
            "longitude": sig.lon if sig.lon is not None else 0.0,
            "domain": "corporate",
            "severity": sig.severity / 100.0 if sig.severity is not None else 0.5,
            "event_category": sig.type,
            "occurred_at": sig.observed_at.isoformat(),
            "raw_text": sig.body,
            "title": sig.subject,
            "actor": sig.source,
            "object": ", ".join(sig.entities) if sig.entities else "",
            "location": sig.geography,
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

@globe_router.get("/flights", summary="Proxy OpenSky Network")
async def get_globe_flights(mil_only: bool = False, limit: int = 4000):
    url = "https://opensky-network.org/api/states/all"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                states = data.get("states", [])
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
    
    # Fallback to empty if opensky rate limits
    return {"flights": [], "stale": True}

@globe_router.get("/vessels", summary="Live AIS proxy or realistic fallback")
async def get_globe_vessels():
    # If we have an AIS_KEY, we could call an AIS provider.
    # Otherwise, generate fallback vessels from port coordinates.
    import random
    vessels = []
    ports = [n for n in state.graph.all_nodes if n.kind in (NodeKind.PORT, NodeKind.SUPPLIER)]
    mmsi_start = 100000000
    for i, port in enumerate(ports[:50]): # 50 simulated vessels around ports
        if port.lat and port.lon:
            lat_offset = (random.random() - 0.5) * 2.0
            lon_offset = (random.random() - 0.5) * 2.0
            vessels.append({
                "mmsi": str(mmsi_start + i),
                "name": f"Vessel-{i}",
                "lat": port.lat + lat_offset,
                "lon": port.lon + lon_offset,
                "speed": random.uniform(5.0, 20.0),
                "heading": random.uniform(0, 360),
                "bucket": random.choice(["cargo", "tanker", "passenger"])
            })
    return {"vessels": vessels, "connected": True}

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
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-90.500,29.750]},"properties":{"id":"stor-us-grain","name":"US Strategic Grain Reserve (Midwest)","kind":"storage","type":"grain","capacity_mb":null,"country":"US"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[10.770,59.910]},"properties":{"id":"stor-no-gas","name":"Norway Naturgassinfrastruktur","kind":"storage","type":"gas","capacity_mb":null,"country":"NO"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[13.380,52.510]},"properties":{"id":"stor-de-gas","name":"German Gas Storage Cluster","kind":"storage","type":"gas","capacity_mb":null,"country":"DE"}},
        {"type":"Feature","geometry":{"type":"Point","coordinates":[-87.650,41.850]},"properties":{"id":"stor-us-midwest","name":"US Midwest Grain Belt Storage","kind":"storage","type":"grain","capacity_mb":null,"country":"US"}},
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

    "gamma_irradiators": {"type": "FeatureCollection", "features": []},
}


@globe_router.get("/infrastructure/{layer_name}", summary="Infrastructure layer GeoJSON")
def get_globe_infrastructure(layer_name: str):
    """Returns a GeoJSON FeatureCollection for the requested infrastructure layer.

    Stress levels on shipping lanes are dynamically computed from current alerts.
    """
    data = _INFRA_FIXTURES.get(layer_name)
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
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[99.650,5.510],[100.350,5.380],[101.250,4.110],[102.750,2.990],[103.840,1.264],[105.200,0.550],[107.500,-0.200],[109.000,0.100]]},"properties":{"id":"sl-malacca","name":"Strait of Malacca","route_type":"sea","baseline_stress":0.40,"traffic":"very_high","chokepoint":True,"stress":_lane_stress(["port-singapore","sup-gamma"],0.40)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[32.290,31.240],[32.550,30.500],[32.600,29.600],[32.400,27.200],[36.900,22.000],[39.800,21.400],[43.150,11.590],[45.000,11.500],[50.500,12.000],[55.000,12.500]]},"properties":{"id":"sl-suez","name":"Suez Canal Route","route_type":"sea","baseline_stress":0.35,"traffic":"very_high","chokepoint":True,"stress":_lane_stress(["port-said"],0.35)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-79.920,8.980],[-80.200,8.640],[-80.500,8.860],[-80.850,9.200],[-80.120,9.340]]},"properties":{"id":"sl-panama","name":"Panama Canal Route","route_type":"sea","baseline_stress":0.20,"traffic":"high","chokepoint":True,"stress":_lane_stress([],0.20)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[57.000,21.500],[56.500,24.500],[56.000,26.000],[55.000,25.500],[54.000,24.500]]},"properties":{"id":"sl-hormuz","name":"Strait of Hormuz","route_type":"sea","baseline_stress":0.45,"traffic":"very_high","chokepoint":True,"stress":_lane_stress([],0.45)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[43.150,11.590],[43.420,12.100],[43.700,12.600],[44.200,13.000],[44.600,13.300],[45.000,11.500]]},"properties":{"id":"sl-bab-el-mandeb","name":"Bab-el-Mandeb Strait","route_type":"sea","baseline_stress":0.50,"traffic":"high","chokepoint":True,"stress":_lane_stress([],0.50)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[120.000,22.500],[119.500,24.000],[118.900,25.600],[118.300,27.100],[117.600,29.200],[121.470,31.230]]},"properties":{"id":"sl-taiwan-strait","name":"Taiwan Strait","route_type":"sea","baseline_stress":0.35,"traffic":"very_high","chokepoint":True,"stress":_lane_stress([],0.35)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[139.690,35.690],[145.000,37.000],[155.000,40.000],[165.000,45.000],[175.000,50.000],[180.000,52.000],[-170.000,52.000],[-155.000,52.000],[-140.000,50.000],[-130.000,46.000],[-118.250,33.740]]},"properties":{"id":"sl-trans-pacific","name":"Trans-Pacific Route (East Asia – US West)","route_type":"sea","baseline_stress":0.20,"traffic":"very_high","chokepoint":False,"stress":_lane_stress(["port-los-angeles"],0.20)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[4.479,51.922],[2.000,51.500],[0.000,51.000],[-5.000,50.000],[-10.000,49.000],[-20.000,47.000],[-35.000,43.000],[-50.000,40.000],[-60.000,38.000],[-70.000,41.000],[-74.010,40.710]]},"properties":{"id":"sl-trans-atlantic","name":"Trans-Atlantic Route (Europe – US East)","route_type":"sea","baseline_stress":0.15,"traffic":"high","chokepoint":False,"stress":_lane_stress(["port-rotterdam"],0.15)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-0.200,50.800],[1.000,51.200],[2.000,51.300],[2.500,51.400],[3.200,51.600],[4.479,51.922]]},"properties":{"id":"sl-english-channel","name":"English Channel","route_type":"sea","baseline_stress":0.30,"traffic":"very_high","chokepoint":True,"stress":_lane_stress(["port-antwerp","port-rotterdam"],0.30)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[103.840,1.264],[107.000,3.000],[110.000,3.500],[114.000,7.000],[117.000,10.000],[119.000,13.000],[121.000,16.000],[124.000,20.000],[121.470,31.230]]},"properties":{"id":"sl-south-china-sea","name":"South China Sea Route","route_type":"sea","baseline_stress":0.30,"traffic":"very_high","chokepoint":False,"stress":_lane_stress(["port-hong-kong","port-shanghai"],0.30)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[9.993,53.551],[10.500,55.000],[11.000,56.500],[12.000,57.500],[13.000,58.000],[14.000,59.000],[15.000,59.500],[17.000,59.000],[18.500,59.200],[21.000,57.000],[24.000,59.500],[25.000,60.000],[25.500,60.200]]},"properties":{"id":"sl-baltic-sea","name":"Baltic Sea Route","route_type":"sea","baseline_stress":0.25,"traffic":"high","chokepoint":False,"stress":_lane_stress(["port-hamburg"],0.25)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[55.000,12.500],[65.000,15.000],[72.880,18.960],[74.000,19.000],[77.600,8.200],[80.280,13.080],[81.000,8.600],[82.000,7.000],[80.500,6.000],[79.850,6.930]]},"properties":{"id":"sl-arabian-sea","name":"Arabian Sea Route (India – Gulf)","route_type":"sea","baseline_stress":0.25,"traffic":"high","chokepoint":False,"stress":_lane_stress(["port-mumbai","port-colombo"],0.25)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[103.840,1.264],[100.000,-2.000],[98.000,-5.000],[96.000,-8.000],[93.000,-10.000],[90.000,-15.000],[85.000,-20.000],[80.000,-25.000],[75.000,-30.000],[72.000,-34.000],[55.000,-35.000],[40.000,-34.000],[32.000,-31.000],[28.000,-26.000],[18.420,-33.920]]},"properties":{"id":"sl-cape-of-good-hope","name":"Cape of Good Hope Route","route_type":"sea","baseline_stress":0.20,"traffic":"high","chokepoint":False,"stress":_lane_stress([],0.20)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[14.250,40.830],[16.000,40.000],[18.000,38.000],[20.000,37.000],[23.000,37.000],[26.000,37.500],[28.000,37.000],[30.000,36.500],[32.290,31.240]]},"properties":{"id":"sl-mediterranean-east","name":"Eastern Mediterranean Route","route_type":"sea","baseline_stress":0.30,"traffic":"high","chokepoint":False,"stress":_lane_stress([],0.30)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[4.479,51.922],[2.350,48.860],[-1.600,43.500],[-5.000,43.300],[-9.150,38.720],[-6.000,36.500],[0.000,39.000],[5.000,36.500],[10.000,37.500],[14.250,40.830]]},"properties":{"id":"sl-mediterranean-west","name":"Western Mediterranean Route","route_type":"sea","baseline_stress":0.25,"traffic":"high","chokepoint":False,"stress":_lane_stress(["port-antwerp"],0.25)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[129.075,35.180],[132.000,34.000],[133.000,34.500],[134.000,34.600],[135.500,34.690],[136.880,35.170],[138.260,34.970],[139.690,35.690]]},"properties":{"id":"sl-japan-sea","name":"Japan Sea Corridor","route_type":"sea","baseline_stress":0.20,"traffic":"high","chokepoint":False,"stress":_lane_stress(["port-busan"],0.20)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[18.420,-33.920],[20.000,-29.000],[25.000,-25.000],[28.240,-26.134],[31.000,-24.000],[34.000,-20.000],[37.317,-3.183],[39.000,3.000],[40.000,11.000],[43.150,11.590]]},"properties":{"id":"sl-east-africa","name":"East Africa Coastal Route","route_type":"sea","baseline_stress":0.30,"traffic":"medium","chokepoint":False,"stress":_lane_stress([],0.30)}},
        {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-79.920,8.980],[-75.000,10.000],[-70.000,12.000],[-65.000,13.000],[-60.000,15.000],[-55.000,16.000],[-45.000,17.000],[-35.000,20.000],[-25.000,23.000],[-15.000,27.000],[-6.000,36.500]]},"properties":{"id":"sl-caribbean-atlantic","name":"Caribbean – Atlantic Route","route_type":"sea","baseline_stress":0.20,"traffic":"medium","chokepoint":False,"stress":_lane_stress([],0.20)}},
    ]

    return {"type": "FeatureCollection", "features": features}


@globe_router.get("/ontology/edges", summary="BOM and supply-chain relationship arcs for globe rendering")
def get_globe_ontology_edges():
    """Returns supply-chain relationship edges with source/target coordinates for globe arc rendering.

    Includes SUPPLIES, DISRUPTS, BLOCKS, AFFECTS, AMPLIFIES, CORROBORATES edges.
    Nodes without coordinates are skipped.
    """
    def _coords(node_id: str):
        node = state.graph.node(node_id)
        if node and node.lat is not None and node.lon is not None:
            return {"lat": node.lat, "lon": node.lon, "name": node.name, "kind": node.kind}
        return None

    arcs = []
    for edge in state.graph.surface_relationships(min_severity=0.05):
        src = _coords(edge.source_id)
        tgt = _coords(edge.target_id)
        if not src or not tgt:
            continue
        arcs.append({
            "id": f"{edge.source_id}→{edge.target_id}",
            "label": edge.label if isinstance(edge.label, str) else edge.label.value,
            "severity": edge.severity if edge.severity else 0.3,
            "source": {"id": edge.source_id, **src},
            "target": {"id": edge.target_id, **tgt},
        })

    return {"arcs": arcs, "total": len(arcs)}


@globe_router.get("/chokepoints/{node_id}/forecast", summary="30-day stress forecast for a chokepoint")
def get_globe_chokepoint_forecast(node_id: str):
    from .scoring import forecast_chokepoint_stress
    try:
        forecast = forecast_chokepoint_stress(
            chokepoint_id=node_id,
            graph=state.graph,
            state=state,
            horizon_days=30,
            threshold=0.70
        )
        return _envelope(forecast, provenance=["bayesian_update", "kalman_filter", "monte_carlo"])
    except ValueError as e:
        raise HTTPException(404, str(e))

app.include_router(globe_router)

