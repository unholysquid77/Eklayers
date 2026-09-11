"""Unit tests for the ontology graph: extractor, inferencer, traversal, surfacing."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from backend.ontology import (
    OntologyGraph, OntologyNode, OntologyEdge,
    ChokepointExtractor, RelationshipInferencer,
    build_ontology_graph,
    NodeKind, EdgeLabel, Severity,
    ChokepointProfile,
)
from backend.models import (
    BomEdge, InventoryPosition, Lane, Part, SKU, Supplier, CustomerOrder,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utcnow():
    return datetime.now(timezone.utc)


def _make_signal(signal_id: str, intensity: float, entity_id: str, credibility: float = 0.9):
    """Minimal stub matching the interface expected by RelationshipInferencer."""
    class _Entity:
        def __init__(self):
            self.id = entity_id
            self.match_confidence = 0.95

    class _Sig:
        def __init__(self):
            self.id = signal_id
            self.type = "quality_event"
            self.source = "TestSource"
            self.intensity = intensity
            self.confidence = 0.9
            self.credibility = credibility
            self.entities = [_Entity()]
            self.observed_at = _utcnow()
            self.lat = None
            self.lon = None

    return _Sig()


def _build_minimal_graph() -> OntologyGraph:
    """Builds a tiny but representative graph: supplier -> part -> sku -> order."""
    suppliers = [
        Supplier(id="sup-a", name="Supplier A", tier=1, country="DE", region="Europe",
                 lat=52.5, lon=13.4, criticality=0.80, categories=["electronics"]),
        Supplier(id="sup-b", name="Supplier B", tier=1, country="JP", region="Asia",
                 lat=35.6, lon=139.7, criticality=0.55, categories=["mechanical"]),
    ]
    parts = [
        Part(id="part-x", name="Part X", supplier_id="sup-a", criticality=0.80),
        Part(id="part-y", name="Part Y", supplier_id="sup-b", criticality=0.50),
    ]
    skus = [
        SKU(id="sku-1", name="SKU 1", parts=["part-x", "part-y"], daily_demand=40.0),
    ]
    orders = [
        CustomerOrder(id="ord-1", sku_id="sku-1", quantity=200, priority="high"),
    ]
    bom_edges = [
        BomEdge(upstream_id="sup-a", downstream_id="part-x", lead_time_days=14),
        BomEdge(upstream_id="sup-b", downstream_id="part-y", lead_time_days=21),
        BomEdge(upstream_id="part-x", downstream_id="sku-1", lead_time_days=2),
        BomEdge(upstream_id="part-y", downstream_id="sku-1", lead_time_days=2),
        BomEdge(upstream_id="sku-1", downstream_id="ord-1", lead_time_days=1),
    ]
    lanes = [
        Lane(id="lane-1", name="Asia-EU", from_hub="hub-sg", to_hub="hub-rot", transit_days=28),
    ]
    inv_map = {
        "part-x": InventoryPosition(node_id="part-x", on_hand=200, daily_demand=40, safety_stock=50),
        "sku-1":  InventoryPosition(node_id="sku-1",  on_hand=100, daily_demand=40, safety_stock=20),
    }
    return build_ontology_graph(suppliers, parts, skus, orders, bom_edges, lanes, inv_map)


# ===========================================================================
# OntologyGraph core
# ===========================================================================

class TestOntologyGraphCore:
    def test_nodes_added_and_retrievable(self):
        g = _build_minimal_graph()
        assert g.node("sup-a") is not None
        assert g.node("part-x").kind == NodeKind.PART
        assert g.node("sku-1").kind == NodeKind.SKU
        assert g.node("ord-1").kind == NodeKind.CUSTOMER_ORDER

    def test_edges_created_with_correct_labels(self):
        g = _build_minimal_graph()
        # Supplier -> Part: SUPPLIES
        assert g.find_edge("sup-a", "part-x", EdgeLabel.SUPPLIES) is not None
        # Part -> SKU: CONSUMES
        assert g.find_edge("part-x", "sku-1", EdgeLabel.CONSUMES) is not None
        # SKU -> Order: FULFILLS
        assert g.find_edge("sku-1", "ord-1", EdgeLabel.FULFILLS) is not None
        # Lane TRAVERSES hub
        assert g.find_edge("lane-1", "hub-sg", EdgeLabel.TRAVERSES) is not None
        # Hub CONNECTS
        assert g.find_edge("hub-sg", "hub-rot", EdgeLabel.CONNECTS) is not None

    def test_supplier_located_in_region_node(self):
        g = _build_minimal_graph()
        rid = "region:Europe"
        assert g.node(rid) is not None
        assert g.find_edge("sup-a", rid, EdgeLabel.LOCATED_IN) is not None

    def test_upsert_node_merges_properties(self):
        g = OntologyGraph()
        g.add_node(OntologyNode(id="n1", kind="supplier", name="Old", criticality=0.3))
        g.upsert_node(OntologyNode(id="n1", kind="supplier", name="New", criticality=0.8))
        assert g.node("n1").name == "New"
        assert g.node("n1").criticality == 0.8

    def test_upsert_edge_keeps_max_severity(self):
        g = OntologyGraph()
        g.add_node(OntologyNode(id="a", kind="supplier"))
        g.add_node(OntologyNode(id="b", kind="part"))
        e1 = OntologyEdge(id="a|disrupts|b", source_id="a", target_id="b",
                          label=EdgeLabel.DISRUPTS, severity=0.5)
        e2 = OntologyEdge(id="a|disrupts|b", source_id="a", target_id="b",
                          label=EdgeLabel.DISRUPTS, severity=0.9)
        g.add_edge(e1)
        g.upsert_edge(e2)
        assert g.find_edge("a", "b", EdgeLabel.DISRUPTS).severity == 0.9

    def test_remove_node_cleans_edges(self):
        g = OntologyGraph()
        g.add_node(OntologyNode(id="a", kind="supplier"))
        g.add_node(OntologyNode(id="b", kind="part"))
        g.add_edge(OntologyEdge(id="e1", source_id="a", target_id="b",
                                label=EdgeLabel.SUPPLIES, severity=0.0))
        g.remove_node("a")
        assert g.node("a") is None
        assert len(g.edges_from("a")) == 0
        assert len(g.edges_to("b")) == 0

    def test_stats_returns_all_kinds(self):
        g = _build_minimal_graph()
        s = g.stats()
        assert s["total_nodes"] > 0
        assert s["total_edges"] > 0
        assert "supplier" in s["nodes_by_kind"]
        assert EdgeLabel.SUPPLIES in s["edges_by_label"]


# ===========================================================================
# Traversal
# ===========================================================================

class TestTraversal:
    def test_downstream_nodes_reaches_order(self):
        g = _build_minimal_graph()
        downstream = dict(g.downstream_nodes("sup-a", max_hops=5))
        assert "part-x" in downstream
        assert "sku-1" in downstream
        assert "ord-1" in downstream

    def test_upstream_nodes_from_order(self):
        g = _build_minimal_graph()
        upstream = dict(g.upstream_nodes("ord-1", max_hops=5))
        assert "sku-1" in upstream

    def test_bfs_label_filter(self):
        g = _build_minimal_graph()
        # Only follow SUPPLIES edges from sup-a -> should reach part-x but not sku-1
        results = g.bfs("sup-a", direction="downstream", max_hops=3,
                        labels=[EdgeLabel.SUPPLIES])
        ids = [n.id for n, _, _ in results]
        assert "part-x" in ids
        assert "sku-1" not in ids   # can't reach via SUPPLIES label alone

    def test_bfs_kind_filter(self):
        g = _build_minimal_graph()
        results = g.bfs("sup-a", direction="downstream", max_hops=5,
                        kinds=[NodeKind.CUSTOMER_ORDER])
        ids = [n.id for n, _, _ in results]
        assert "ord-1" in ids
        assert "sku-1" not in ids   # filtered out (wrong kind)

    def test_shortest_path_found(self):
        g = _build_minimal_graph()
        path = g.shortest_path("sup-a", "ord-1")
        node_ids = [n.id for n, _ in path]
        assert node_ids[0] == "sup-a"
        assert node_ids[-1] == "ord-1"
        assert "sku-1" in node_ids

    def test_shortest_path_not_found_returns_empty(self):
        g = _build_minimal_graph()
        # ord-1 -> sup-a is reverse direction; no path
        path = g.shortest_path("ord-1", "sup-a")
        assert path == []

    def test_neighbors_downstream_only(self):
        g = _build_minimal_graph()
        nbrs = g.neighbors("sup-a", direction="downstream")
        ids = [n.id for n, _ in nbrs]
        assert "part-x" in ids

    def test_find_alternates_empty_when_none(self):
        g = _build_minimal_graph()
        assert g.find_alternates("sup-a") == []

    def test_find_alternates_after_alternate_edge(self):
        g = _build_minimal_graph()
        g.add_node(OntologyNode(id="sup-c", kind="supplier", name="Alt Supplier"))
        g.add_edge(OntologyEdge(
            id="sup-c|alternative_to|sup-a",
            source_id="sup-c", target_id="sup-a",
            label=EdgeLabel.ALTERNATIVE_TO,
        ))
        alts = g.find_alternates("sup-a")
        assert any(n.id == "sup-c" for n in alts)

    def test_nearest_node_by_geo(self):
        g = _build_minimal_graph()
        # Berlin coordinates -> should find sup-a (Germany, lat=52.5, lon=13.4)
        nearest = g.nearest_node(52.5, 13.4, kinds=[NodeKind.SUPPLIER])
        assert nearest == "sup-a"


# ===========================================================================
# ChokepointExtractor
# ===========================================================================

class TestChokepointExtractor:
    def test_supplier_with_many_downstream_detected(self):
        g = _build_minimal_graph()
        extractor = ChokepointExtractor()
        profiles = extractor.extract_all(g)
        ids = [p.node_id for p in profiles]
        # sup-a has downstream: part-x, sku-1, ord-1 (3 nodes) -> should be detected
        assert "sup-a" in ids

    def test_profile_has_reasons(self):
        g = _build_minimal_graph()
        profiles = ChokepointExtractor().extract_all(g)
        for p in profiles:
            assert len(p.reasons) > 0

    def test_profile_has_severity(self):
        g = _build_minimal_graph()
        profiles = ChokepointExtractor().extract_all(g)
        for p in profiles:
            assert p.severity in {s.value for s in Severity}

    def test_apply_stamps_graph_nodes(self):
        g = _build_minimal_graph()
        extractor = ChokepointExtractor()
        profiles = extractor.extract_all(g)
        extractor.apply(g, profiles)
        # At least one node should be marked as chokepoint
        assert len(g.chokepoints()) > 0

    def test_apply_resets_previous_flags(self):
        g = _build_minimal_graph()
        # Manually flag a node
        g.node("lane-1").is_chokepoint = True
        g.node("lane-1").chokepoint_score = 0.99
        extractor = ChokepointExtractor()
        profiles = extractor.extract_all(g)
        extractor.apply(g, profiles)
        # lane-1 should only remain a chokepoint if extractor also detected it
        lane_node = g.node("lane-1")
        lane_in_profiles = any(p.node_id == "lane-1" for p in profiles)
        assert lane_node.is_chokepoint == lane_in_profiles

    def test_signal_convergence_raises_score(self):
        g = _build_minimal_graph()
        signals = [
            _make_signal("s1", 0.85, "sup-a"),
            _make_signal("s2", 0.90, "sup-a"),
            _make_signal("s3", 0.75, "sup-a"),
        ]
        extractor = ChokepointExtractor()
        profiles_with = extractor.extract_all(g, signals)
        profiles_without = extractor.extract_all(g)
        score_with = next((p.chokepoint_score for p in profiles_with if p.node_id == "sup-a"), 0.0)
        score_without = next((p.chokepoint_score for p in profiles_without if p.node_id == "sup-a"), 0.0)
        assert score_with >= score_without   # convergence always >= baseline

    def test_hub_geographic_bottleneck_detected(self):
        g = _build_minimal_graph()
        # hub-sg has 2 TRAVERSES edges (lane-1 has from_hub=hub-sg, to_hub=hub-rot)
        # Also add another lane through hub-sg to ensure it hits the GEO_LANE_MIN
        g.add_node(OntologyNode(id="lane-2", kind=NodeKind.LANE, name="Lane 2"))
        from backend.ontology import OntologyEdge, EdgeLabel
        g.add_edge(OntologyEdge(
            id="lane-2|traverses|hub-sg",
            source_id="lane-2", target_id="hub-sg",
            label=EdgeLabel.TRAVERSES,
        ))
        extractor = ChokepointExtractor()
        profiles = extractor.extract_all(g)
        hub_profile = next((p for p in profiles if p.node_id == "hub-sg"), None)
        assert hub_profile is not None
        assert any("Geographic bottleneck" in r for r in hub_profile.reasons)

    def test_surface_chokepoints_sorted_by_score(self):
        g = _build_minimal_graph()
        extractor = ChokepointExtractor()
        extractor.apply(g, extractor.extract_all(g))
        cps = g.surface_chokepoints()
        scores = [n.chokepoint_score for n in cps]
        assert scores == sorted(scores, reverse=True)


# ===========================================================================
# RelationshipInferencer
# ===========================================================================

class TestRelationshipInferencer:
    def _state_stub(self, bom_edges=(), supplier_metrics=()):
        class _State:
            pass
        s = _State()
        s.bom_edges = list(bom_edges)
        s.supplier_metrics = list(supplier_metrics)
        return s

    def test_high_intensity_signal_creates_disrupts_edge(self):
        g = _build_minimal_graph()
        sig = _make_signal("sig-1", intensity=0.85, entity_id="sup-a")
        inferencer = RelationshipInferencer()
        inferencer.infer(g, [sig], self._state_stub())
        edge = g.find_edge("signal:sig-1", "sup-a", EdgeLabel.DISRUPTS)
        assert edge is not None
        assert edge.severity > 0.0
        assert edge.nl_tag == "disrupts"

    def test_low_intensity_signal_creates_affects_edge(self):
        g = _build_minimal_graph()
        sig = _make_signal("sig-2", intensity=0.40, entity_id="sup-b")
        RelationshipInferencer().infer(g, [sig], self._state_stub())
        assert g.find_edge("signal:sig-2", "sup-b", EdgeLabel.AFFECTS) is not None
        assert g.find_edge("signal:sig-2", "sup-b", EdgeLabel.DISRUPTS) is None

    def test_signal_node_added_to_graph(self):
        g = _build_minimal_graph()
        sig = _make_signal("sig-3", intensity=0.70, entity_id="sup-a")
        RelationshipInferencer().infer(g, [sig], self._state_stub())
        assert g.node("signal:sig-3") is not None
        assert g.node("signal:sig-3").kind == NodeKind.RISK_SIGNAL

    def test_corroborates_edge_between_shared_signals(self):
        g = _build_minimal_graph()
        s1 = _make_signal("sig-4", 0.80, "sup-a")
        s2 = _make_signal("sig-5", 0.75, "sup-a")
        RelationshipInferencer().infer(g, [s1, s2], self._state_stub())
        corr = g.find_edge("signal:sig-4", "signal:sig-5", EdgeLabel.CORROBORATES)
        assert corr is not None
        assert corr.nl_tag == "corroborates"

    def test_no_corroboration_for_single_signal(self):
        g = _build_minimal_graph()
        sig = _make_signal("sig-6", 0.80, "sup-a")
        RelationshipInferencer().infer(g, [sig], self._state_stub())
        corr_edges = g.edges_by_label(EdgeLabel.CORROBORATES)
        assert len(corr_edges) == 0

    def test_bom_alternate_creates_alternative_to(self):
        g = _build_minimal_graph()
        g.add_node(OntologyNode(id="sup-c", kind="supplier", name="Alternate C"))
        bom_edge = BomEdge(
            upstream_id="sup-a", downstream_id="part-x",
            approved_alternate_ids=["sup-c"],
        )
        state = self._state_stub(bom_edges=[bom_edge])
        RelationshipInferencer().infer(g, [], state)
        assert g.find_edge("sup-c", "sup-a", EdgeLabel.ALTERNATIVE_TO) is not None

    def test_bom_alternate_creates_replaces_when_primary_is_chokepoint(self):
        g = _build_minimal_graph()
        # Mark sup-a as chokepoint
        g.node("sup-a").is_chokepoint = True
        g.node("sup-a").chokepoint_score = 0.80
        g.add_node(OntologyNode(id="sup-c", kind="supplier", name="Alternate C"))
        bom_edge = BomEdge(
            upstream_id="sup-a", downstream_id="part-x",
            approved_alternate_ids=["sup-c"],
        )
        RelationshipInferencer().infer(g, [], self._state_stub(bom_edges=[bom_edge]))
        assert g.find_edge("sup-c", "sup-a", EdgeLabel.REPLACES) is not None

    def test_chokepoint_blocks_lane(self):
        g = _build_minimal_graph()
        # Make hub-sg a chokepoint (lane-1 traverses hub-sg)
        g.node("hub-sg").is_chokepoint = True
        g.node("hub-sg").chokepoint_score = 0.70
        RelationshipInferencer().infer(g, [], self._state_stub())
        block = g.find_edge("hub-sg", "lane-1", EdgeLabel.BLOCKS)
        assert block is not None
        assert block.severity == pytest.approx(0.70, abs=0.01)
        assert block.nl_tag == "blocks"

    def test_chokepoint_amplifies_co_located(self):
        g = _build_minimal_graph()
        # Two suppliers in same region both chokepoints -> AMPLIFIES
        g.node("sup-a").is_chokepoint = True
        g.node("sup-a").chokepoint_score = 0.75
        g.add_node(OntologyNode(
            id="sup-z", kind="supplier", name="Sup Z",
            region="Europe", is_chokepoint=True, chokepoint_score=0.65,
        ))
        RelationshipInferencer().infer(g, [], self._state_stub())
        amp = g.find_edge("sup-a", "sup-z", EdgeLabel.AMPLIFIES)
        assert amp is not None
        assert amp.nl_tag == "amplifies"

    def test_routes_through_edge_for_supplier_through_chokepoint(self):
        g = _build_minimal_graph()
        # part-x is a chokepoint; sup-a reaches it downstream
        g.node("part-x").is_chokepoint = True
        g.node("part-x").chokepoint_score = 0.60
        RelationshipInferencer().infer(g, [], self._state_stub())
        rt = g.find_edge("sup-a", "part-x", EdgeLabel.ROUTES_THROUGH)
        assert rt is not None
        assert rt.nl_tag == "routes_through"


# ===========================================================================
# Surface API
# ===========================================================================

class TestSurfaceMethods:
    def test_surface_events_returns_signal_nodes(self):
        g = _build_minimal_graph()
        sig = _make_signal("ev-1", 0.80, "sup-a")
        RelationshipInferencer().infer(g, [sig], object())
        events = g.surface_events()
        assert any(n.id == "signal:ev-1" for n in events)

    def test_surface_disruptions_returns_disrupts_edges(self):
        g = _build_minimal_graph()
        sig = _make_signal("ev-2", 0.85, "sup-a")
        RelationshipInferencer().infer(g, [sig], object())
        disruptions = g.surface_disruptions()
        assert len(disruptions) > 0
        assert all(e.label == EdgeLabel.DISRUPTS for e in disruptions)

    def test_surface_relationships_filter_by_label(self):
        g = _build_minimal_graph()
        edges = g.surface_relationships(label=EdgeLabel.SUPPLIES)
        assert all(e.label == EdgeLabel.SUPPLIES for e in edges)

    def test_surface_relationships_filter_by_source_kind(self):
        g = _build_minimal_graph()
        edges = g.surface_relationships(source_kind=NodeKind.SUPPLIER)
        src_kinds = {g.node(e.source_id).kind for e in edges if g.node(e.source_id)}
        assert all(k == NodeKind.SUPPLIER for k in src_kinds)

    def test_node_risk_context_has_all_keys(self):
        g = _build_minimal_graph()
        ctx = g.node_risk_context("sup-a")
        for key in ("node_id", "kind", "is_chokepoint", "chokepoint_score",
                    "disruption_count", "has_alternates", "downstream_node_count"):
            assert key in ctx

    def test_severity_from_score(self):
        assert Severity.from_score(0.90) == Severity.CRITICAL
        assert Severity.from_score(0.60) == Severity.HIGH
        assert Severity.from_score(0.30) == Severity.MEDIUM
        assert Severity.from_score(0.10) == Severity.LOW
        assert Severity.from_score(0.00) == Severity.NONE

    def test_edge_nl_tag_alias(self):
        e = OntologyEdge(id="x", source_id="a", target_id="b",
                         label=EdgeLabel.DISRUPTS)
        assert e.nl_tag == "disrupts"
        assert e.upstream_id == "a"
        assert e.downstream_id == "b"
