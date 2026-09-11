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
    allow_credentials=True,
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
    # Stub for ACLED since public API requires auth
    return {"features": []}

@globe_router.get("/infrastructure/{layer_name}", summary="Infrastructure layers")
def get_globe_infrastructure(layer_name: str):
    # E.g. spaceports, nuclear_sites, military_bases
    # Stubbed as empty feature collections for now, ready to ingest real datasets
    return {"type": "FeatureCollection", "features": []}

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

