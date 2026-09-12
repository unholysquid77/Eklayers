"""Ontology graph for SupplyChain Sentinel.

Provides a typed, labeled semantic graph storing every operational entity,
risk signal, alert and chokepoint, plus all named (NL-tagged) relationships.

Key classes
-----------
OntologyGraph         -- full CRUD + traversal + surfacing methods
ChokepointExtractor   -- auto-detects chokepoints after every ingestion
RelationshipInferencer -- creates NL-labeled edges after every ingestion
build_ontology_graph() -- factory: builds graph from AppState collections
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


# ==========================================================================
# Enumerations
# ==========================================================================

class NodeKind(str, Enum):
    """All ontology node types."""
    SUPPLIER         = "supplier"
    SUPPLIER_SITE    = "supplier_site"
    PART             = "part"
    MATERIAL         = "material"
    SKU              = "sku"
    BOM              = "bom"
    PURCHASE_ORDER   = "purchase_order"
    CUSTOMER_ORDER   = "order"
    INVENTORY        = "inventory"
    LANE             = "lane"
    SHIPMENT         = "shipment"
    CARRIER          = "carrier"
    PORT             = "port"
    HUB              = "hub"
    TRADE_ROUTE      = "trade_route"
    RISK_SIGNAL      = "risk_signal"
    ALERT            = "alert"
    MITIGATION       = "mitigation"
    CHOKEPOINT       = "chokepoint"
    REGION           = "region"


class EdgeLabel(str, Enum):
    """NL-tagged relationship types -- human-readable edge labels."""
    # Structural
    OWNS              = "owns"             # org owns a site/asset
    SUPPLIES          = "supplies"         # supplier supplies a part
    MAKES             = "makes"            # site makes a product
    CONSUMES          = "consumes"         # SKU consumes a part (BOM)
    BOM_CONTAINS      = "bom_contains"     # BOM contains part
    FULFILLS          = "fulfills"         # SKU/order fulfills customer order
    # Logistics
    SHIPS_ON          = "ships_on"         # shipment ships on a lane
    TRAVERSES         = "traverses"        # lane passes through a port/hub
    USES_HUB          = "uses_hub"         # route uses a logistics hub
    OPERATED_BY       = "operated_by"      # lane operated by a carrier
    CONNECTS          = "connects"         # lane connects two hubs
    LOCATED_IN        = "located_in"       # supplier located in a region
    HAS_INVENTORY     = "has_inventory"    # node has inventory position
    DEPENDS_ON        = "depends_on"       # generic upstream dependency
    # Risk / disruption
    AFFECTS           = "affects"          # signal/alert affects node (low-medium)
    DISRUPTS          = "disrupts"         # signal actively disrupts node (high)
    CORROBORATES      = "corroborates"     # signal corroborates another signal
    BLOCKS            = "blocks"           # chokepoint blocks a lane when failed
    CONCENTRATES_RISK = "concentrates_risk"  # node concentrates risk in a region
    # Substitutability
    ALTERNATIVE_TO    = "alternative_to"   # node is an approved alternative
    REPLACES          = "replaces"          # node replaces another in a disruption
    # Chokepoint relations
    ROUTES_THROUGH    = "routes_through"   # supply path routes through a chokepoint
    AMPLIFIES         = "amplifies"        # one disruption amplifies another
    MITIGATED_BY      = "mitigated_by"    # disruption is mitigated by option
    TRIGGERS          = "triggers"         # one event triggers another


class Severity(str, Enum):
    """Human-readable severity tiers."""
    CRITICAL = "critical"   # score > 0.75
    HIGH     = "high"       # score > 0.50
    MEDIUM   = "medium"     # score > 0.25
    LOW      = "low"        # score > 0.0
    NONE     = "none"       # score = 0.0

    @staticmethod
    def from_score(score: float) -> "Severity":
        if score > 0.75: return Severity.CRITICAL
        if score > 0.50: return Severity.HIGH
        if score > 0.25: return Severity.MEDIUM
        if score > 0.0:  return Severity.LOW
        return Severity.NONE


# ==========================================================================
# Data structures
# ==========================================================================

@dataclass
class ChokepointProfile:
    """Explains why a node was detected as a chokepoint."""
    node_id: str
    node_kind: str
    chokepoint_score: float       # [0, 1] composite
    severity: str                 # Severity enum value
    reasons: list[str]            # human-readable detection reasons
    downstream_count: int
    order_count: int
    sku_count: int
    has_alternates: bool
    signal_count: int
    detected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def as_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "node_kind": self.node_kind,
            "chokepoint_score": self.chokepoint_score,
            "severity": self.severity,
            "reasons": self.reasons,
            "downstream_count": self.downstream_count,
            "order_count": self.order_count,
            "sku_count": self.sku_count,
            "has_alternates": self.has_alternates,
            "signal_count": self.signal_count,
            "detected_at": self.detected_at.isoformat(),
        }


@dataclass
class OntologyNode:
    """A typed node in the ontology graph."""
    id: str
    kind: str
    name: str = ""
    properties: dict[str, Any] = field(default_factory=dict)
    criticality: float = 0.5
    lat: float | None = None
    lon: float | None = None
    region: str = ""
    inventory_days: float | None = None
    is_chokepoint: bool = False
    chokepoint_score: float = 0.0
    chokepoint_profile: ChokepointProfile | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def touch(self, **kwargs) -> None:
        for k, v in kwargs.items():
            if hasattr(self, k):
                setattr(self, k, v)
        self.updated_at = datetime.now(timezone.utc)

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "name": self.name,
            "criticality": self.criticality,
            "lat": self.lat,
            "lon": self.lon,
            "region": self.region,
            "inventory_days": self.inventory_days,
            "is_chokepoint": self.is_chokepoint,
            "chokepoint_score": self.chokepoint_score,
            "severity_tier": Severity.from_score(self.chokepoint_score).value,
            "chokepoint_profile": self.chokepoint_profile.as_dict() if self.chokepoint_profile else None,
            "properties": self.properties,
        }


@dataclass
class OntologyEdge:
    """A labeled, directed edge in the ontology graph.

    label / nl_tag  -- human-readable NL string ("disrupts", "owns", ...)
    severity        -- strength of the relationship [0, 1]
    propagation_probability / impact_multiplier  -- used by MC engine
    """
    id: str
    source_id: str
    target_id: str
    label: str                         # EdgeLabel value
    severity: float = 0.0              # [0, 1]
    confidence: float = 1.0
    properties: dict[str, Any] = field(default_factory=dict)
    provenance: list[str] = field(default_factory=list)
    propagation_probability: float = 0.85
    impact_multiplier: float = 0.65
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Backwards-compatible aliases used by scoring.py / MC engine
    @property
    def upstream_id(self) -> str:
        return self.source_id

    @property
    def downstream_id(self) -> str:
        return self.target_id

    @property
    def severity_tier(self) -> str:
        return Severity.from_score(self.severity).value

    @property
    def nl_tag(self) -> str:
        return self.label

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "source_id": self.source_id,
            "target_id": self.target_id,
            "label": self.label,
            "nl_tag": self.label,
            "severity": self.severity,
            "severity_tier": self.severity_tier,
            "confidence": self.confidence,
            "propagation_probability": self.propagation_probability,
            "impact_multiplier": self.impact_multiplier,
            "provenance": self.provenance,
            "properties": self.properties,
            "created_at": self.created_at.isoformat(),
        }


# ==========================================================================
# OntologyGraph
# ==========================================================================

class OntologyGraph:
    """Semantic supply-chain ontology graph.

    Stores every operational entity, risk signal, alert, chokepoint and
    the NL-labeled relationships between them.  Rebuilt from operational
    state on every ingestion event; never persisted between runs.
    """

    def __init__(self) -> None:
        self._nodes:      dict[str, OntologyNode]  = {}
        self._edges:      dict[str, OntologyEdge]  = {}
        self._adj:        dict[str, list[str]]     = {}  # source_id -> [edge_id]
        self._radj:       dict[str, list[str]]     = {}  # target_id -> [edge_id]
        self._node_edges: dict[str, set[str]]      = {}  # node_id   -> {edge_id}

    # ------------------------------------------------------------------
    # Node CRUD
    # ------------------------------------------------------------------

    def add_node(self, node: OntologyNode) -> None:
        self._nodes[node.id] = node
        self._adj.setdefault(node.id, [])
        self._radj.setdefault(node.id, [])
        self._node_edges.setdefault(node.id, set())

    def upsert_node(self, node: OntologyNode) -> OntologyNode:
        if node.id in self._nodes:
            ex = self._nodes[node.id]
            for k in ("name", "criticality", "lat", "lon", "region",
                      "inventory_days", "is_chokepoint", "chokepoint_score",
                      "chokepoint_profile"):
                v = getattr(node, k, None)
                if v is not None:
                    setattr(ex, k, v)
            ex.properties.update(node.properties)
            ex.updated_at = datetime.now(timezone.utc)
            return ex
        self.add_node(node)
        return node

    def remove_node(self, node_id: str) -> None:
        if node_id not in self._nodes:
            return
        for eid in list(self._node_edges.get(node_id, set())):
            self._del_edge(eid)
        del self._nodes[node_id]
        self._adj.pop(node_id, None)
        self._radj.pop(node_id, None)
        self._node_edges.pop(node_id, None)

    def node(self, node_id: str) -> OntologyNode | None:
        return self._nodes.get(node_id)

    @property
    def all_nodes(self) -> list[OntologyNode]:
        return list(self._nodes.values())

    def nodes_by_kind(self, kind: str) -> list[OntologyNode]:
        return [n for n in self._nodes.values() if n.kind == kind]

    def chokepoints(self) -> list[OntologyNode]:
        return sorted(
            [n for n in self._nodes.values() if n.is_chokepoint],
            key=lambda n: -n.chokepoint_score,
        )

    # ------------------------------------------------------------------
    # Edge CRUD
    # ------------------------------------------------------------------

    def add_edge(self, edge: OntologyEdge) -> None:
        self._edges[edge.id] = edge
        self._adj.setdefault(edge.source_id, []).append(edge.id)
        self._radj.setdefault(edge.target_id, []).append(edge.id)
        self._node_edges.setdefault(edge.source_id, set()).add(edge.id)
        self._node_edges.setdefault(edge.target_id, set()).add(edge.id)

    def upsert_edge(self, edge: OntologyEdge) -> OntologyEdge:
        ex = self.find_edge(edge.source_id, edge.target_id, edge.label)
        if ex:
            ex.severity = max(ex.severity, edge.severity)
            ex.confidence = max(ex.confidence, edge.confidence)
            ex.propagation_probability = edge.propagation_probability
            ex.impact_multiplier = edge.impact_multiplier
            ex.properties.update(edge.properties)
            ex.provenance = list(dict.fromkeys(ex.provenance + edge.provenance))
            return ex
        self.add_edge(edge)
        return edge

    def _del_edge(self, edge_id: str) -> None:
        e = self._edges.pop(edge_id, None)
        if not e:
            return
        adj = self._adj.get(e.source_id, [])
        if edge_id in adj:
            adj.remove(edge_id)
        radj = self._radj.get(e.target_id, [])
        if edge_id in radj:
            radj.remove(edge_id)
        self._node_edges.get(e.source_id, set()).discard(edge_id)
        self._node_edges.get(e.target_id, set()).discard(edge_id)

    def find_edge(self, src: str, tgt: str, label: str) -> OntologyEdge | None:
        for eid in self._adj.get(src, []):
            e = self._edges.get(eid)
            if e and e.target_id == tgt and e.label == label:
                return e
        return None

    def edge(self, edge_id: str) -> OntologyEdge | None:
        return self._edges.get(edge_id)

    @property
    def all_edges(self) -> list[OntologyEdge]:
        return list(self._edges.values())

    def edges_from(self, node_id: str, label: str | None = None) -> list[OntologyEdge]:
        edges = [self._edges[eid] for eid in self._adj.get(node_id, []) if eid in self._edges]
        return [e for e in edges if label is None or e.label == label]

    def edges_to(self, node_id: str, label: str | None = None) -> list[OntologyEdge]:
        edges = [self._edges[eid] for eid in self._radj.get(node_id, []) if eid in self._edges]
        return [e for e in edges if label is None or e.label == label]

    def edges_by_label(self, label: str) -> list[OntologyEdge]:
        return [e for e in self._edges.values() if e.label == label]

    def remove_edges_by_label(self, label: str) -> int:
        ids = [e.id for e in self._edges.values() if e.label == label]
        for eid in ids:
            self._del_edge(eid)
        return len(ids)

    # ------------------------------------------------------------------
    # Traversal
    # ------------------------------------------------------------------

    def bfs(
        self,
        start_id: str,
        direction: str = "downstream",
        max_hops: int = 6,
        labels: list[str] | None = None,
        kinds: list[str] | None = None,
    ) -> list[tuple[OntologyNode, int, OntologyEdge | None]]:
        """BFS traversal. Returns [(node, hop_distance, via_edge)]."""
        if start_id not in self._nodes:
            return []
        visited: dict[str, int] = {start_id: 0}
        queue: list[tuple[str, int, OntologyEdge | None]] = [(start_id, 0, None)]
        result: list[tuple[OntologyNode, int, OntologyEdge | None]] = []
        while queue:
            cur_id, hop, via = queue.pop(0)
            n = self._nodes.get(cur_id)
            if not n:
                continue
            if cur_id != start_id:
                if kinds is None or n.kind in kinds:
                    result.append((n, hop, via))
            if hop >= max_hops:
                continue
            candidates: list[OntologyEdge] = []
            if direction in ("downstream", "both"):
                candidates.extend(self.edges_from(cur_id))
            if direction in ("upstream", "both"):
                candidates.extend(self.edges_to(cur_id))
            for edge in candidates:
                nxt = (edge.target_id if edge.source_id == cur_id
                       else edge.source_id)
                if nxt in visited:
                    continue
                if labels and edge.label not in labels:
                    continue
                visited[nxt] = hop + 1
                queue.append((nxt, hop + 1, edge))
        return result

    def downstream_nodes(self, node_id: str, max_hops: int = 6) -> list[tuple[str, int]]:
        """Backward-compatible interface matching SupplyGraph."""
        return [(n.id, h) for n, h, _ in self.bfs(node_id, "downstream", max_hops)]

    def upstream_nodes(self, node_id: str, max_hops: int = 6) -> list[tuple[str, int]]:
        return [(n.id, h) for n, h, _ in self.bfs(node_id, "upstream", max_hops)]

    def shortest_path(
        self,
        source_id: str,
        target_id: str,
        labels: list[str] | None = None,
    ) -> list[tuple[OntologyNode, OntologyEdge | None]]:
        """BFS shortest directed path source -> target."""
        if source_id not in self._nodes or target_id not in self._nodes:
            return []
        parent: dict[str, tuple[str | None, OntologyEdge | None]] = {source_id: (None, None)}
        queue = [source_id]
        visited = {source_id}
        found = False
        while queue and not found:
            cur = queue.pop(0)
            for edge in self.edges_from(cur):
                if labels and edge.label not in labels:
                    continue
                nxt = edge.target_id
                if nxt in visited:
                    continue
                visited.add(nxt)
                parent[nxt] = (cur, edge)
                if nxt == target_id:
                    found = True
                    break
                queue.append(nxt)
        if target_id not in parent:
            return []
        path: list[tuple[OntologyNode, OntologyEdge | None]] = []
        cur2: str | None = target_id
        while cur2 is not None:
            prev_id, edge = parent[cur2]
            path.append((self._nodes[cur2], edge))
            cur2 = prev_id
        path.reverse()
        return path

    def neighbors(
        self,
        node_id: str,
        direction: str = "both",
        labels: list[str] | None = None,
    ) -> list[tuple[OntologyNode, OntologyEdge]]:
        """Direct neighbors with connecting edge."""
        result: list[tuple[OntologyNode, OntologyEdge]] = []
        if direction in ("downstream", "both"):
            for e in self.edges_from(node_id):
                if labels and e.label not in labels:
                    continue
                n = self._nodes.get(e.target_id)
                if n:
                    result.append((n, e))
        if direction in ("upstream", "both"):
            for e in self.edges_to(node_id):
                if labels and e.label not in labels:
                    continue
                n = self._nodes.get(e.source_id)
                if n:
                    result.append((n, e))
        return result

    def find_alternates(self, node_id: str) -> list[OntologyNode]:
        """Nodes declared ALTERNATIVE_TO or REPLACES this node."""
        seen: dict[str, OntologyNode] = {}
        for lbl in (EdgeLabel.ALTERNATIVE_TO, EdgeLabel.REPLACES):
            for e in self.edges_by_label(lbl):
                if e.target_id == node_id:
                    n = self._nodes.get(e.source_id)
                    if n:
                        seen[n.id] = n
        return list(seen.values())

    def nearest_node(
        self, lat: float, lon: float,
        kinds: list[str] | None = None,
    ) -> str | None:
        best_id: str | None = None
        best = float("inf")
        for n in self._nodes.values():
            if n.lat is None or n.lon is None:
                continue
            if kinds and n.kind not in kinds:
                continue
            d = (n.lat - lat) ** 2 + (n.lon - lon) ** 2
            if d < best:
                best = d
                best_id = n.id
        return best_id

    # ------------------------------------------------------------------
    # Surface methods
    # ------------------------------------------------------------------

    def surface_events(self) -> list[OntologyNode]:
        """All RiskSignal nodes in the graph."""
        return self.nodes_by_kind(NodeKind.RISK_SIGNAL)

    def surface_alerts(self) -> list[OntologyNode]:
        return self.nodes_by_kind(NodeKind.ALERT)

    def surface_chokepoints(self, min_score: float = 0.0) -> list[OntologyNode]:
        return [n for n in self.chokepoints() if n.chokepoint_score >= min_score]

    def surface_disruptions(self) -> list[OntologyEdge]:
        """All DISRUPTS edges -- active high-intensity relationships."""
        return self.edges_by_label(EdgeLabel.DISRUPTS)

    def surface_relationships(
        self,
        label: str | None = None,
        min_severity: float = 0.0,
        source_kind: str | None = None,
        target_kind: str | None = None,
    ) -> list[OntologyEdge]:
        """Filter edges by label, severity threshold, and node kinds."""
        edges = self.edges_by_label(label) if label else self.all_edges
        result = [e for e in edges if e.severity >= min_severity]
        if source_kind:
            result = [e for e in result
                      if (n := self._nodes.get(e.source_id)) and n.kind == source_kind]
        if target_kind:
            result = [e for e in result
                      if (n := self._nodes.get(e.target_id)) and n.kind == target_kind]
        return sorted(result, key=lambda e: -e.severity)

    def node_risk_context(self, node_id: str) -> dict:
        """Full risk context for a node."""
        n = self._nodes.get(node_id)
        if not n:
            return {}
        disruptions = (self.edges_to(node_id, EdgeLabel.DISRUPTS) +
                       self.edges_to(node_id, EdgeLabel.AFFECTS))
        alts = self.find_alternates(node_id)
        downstream = self.downstream_nodes(node_id)
        blocks = self.edges_from(node_id, EdgeLabel.BLOCKS)
        routes = self.edges_from(node_id, EdgeLabel.ROUTES_THROUGH)
        return {
            "node_id": node_id,
            "kind": n.kind,
            "name": n.name,
            "is_chokepoint": n.is_chokepoint,
            "chokepoint_score": n.chokepoint_score,
            "severity_tier": Severity.from_score(n.chokepoint_score).value,
            "criticality": n.criticality,
            "disruption_count": len(disruptions),
            "max_disruption_severity": max((e.severity for e in disruptions), default=0.0),
            "has_alternates": bool(alts),
            "alternate_ids": [a.id for a in alts],
            "downstream_node_count": len(downstream),
            "blocks_count": len(blocks),
            "routes_through_count": len(routes),
            "chokepoint_profile": n.chokepoint_profile.as_dict() if n.chokepoint_profile else None,
        }

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def stats(self) -> dict:
        kinds: dict[str, int] = {}
        for n in self._nodes.values():
            kinds[n.kind] = kinds.get(n.kind, 0) + 1
        labels_count: dict[str, int] = {}
        for e in self._edges.values():
            labels_count[e.label] = labels_count.get(e.label, 0) + 1
        return {
            "total_nodes": len(self._nodes),
            "total_edges": len(self._edges),
            "chokepoints": len(self.chokepoints()),
            "nodes_by_kind": kinds,
            "edges_by_label": labels_count,
        }


# ==========================================================================
# Chokepoint Extractor
# ==========================================================================

class ChokepointExtractor:
    """Detects chokepoints using six heuristics after every ingestion.

    Heuristics
    ----------
    1. High downstream fan-out  -- many dependent nodes
    2. Single source            -- no approved alternates, yet has dependents
    3. High criticality         -- criticality >= threshold
    4. Geographic bottleneck    -- port/hub many lanes traverse
    5. Signal convergence       -- multiple live signals targeting this node
    6. Direct order exposure    -- customer orders directly downstream
    """

    CRITICALITY_THRESHOLD  = 0.45
    DOWNSTREAM_THRESHOLD   = 2
    SIGNAL_CONVERGENCE_MIN = 2
    GEO_LANE_MIN           = 2

    def extract_all(
        self,
        graph: OntologyGraph,
        signals: list = (),
    ) -> list[ChokepointProfile]:
        signal_counts: dict[str, int] = {}
        for sig in signals:
            for entity in getattr(sig, "entities", []):
                signal_counts[entity.id] = signal_counts.get(entity.id, 0) + 1

        profiles: list[ChokepointProfile] = []
        _skip_kinds = {NodeKind.RISK_SIGNAL, NodeKind.ALERT,
                       NodeKind.MITIGATION, NodeKind.REGION, NodeKind.CHOKEPOINT}

        for node in graph.all_nodes:
            if node.kind in _skip_kinds:
                continue

            reasons: list[str] = []
            scores:  list[float] = []

            downstream = graph.downstream_nodes(node.id, max_hops=6)
            sku_ids   = {nid for nid, _ in downstream
                         if (dn := graph.node(nid)) and dn.kind == NodeKind.SKU}
            order_ids = {nid for nid, _ in downstream
                         if (dn := graph.node(nid)) and dn.kind == NodeKind.CUSTOMER_ORDER}
            alts      = graph.find_alternates(node.id)
            sig_count = signal_counts.get(node.id, 0)

            # 1. Fan-out
            if len(downstream) >= self.DOWNSTREAM_THRESHOLD:
                scores.append(min(len(downstream) / 15.0, 1.0))
                if len(downstream) >= 4:
                    reasons.append(f"High fan-out: {len(downstream)} downstream dependents")

            # 2. Single source
            if not alts and len(downstream) > 0:
                scores.append(0.72)
                reasons.append("Single source: no approved alternates declared")

            # 3. High criticality
            if node.criticality >= self.CRITICALITY_THRESHOLD:
                scores.append(node.criticality)
                reasons.append(f"High criticality: {node.criticality:.2f}")

            # 4. Geographic bottleneck
            if node.kind in (NodeKind.PORT, NodeKind.HUB):
                converging = (
                    graph.edges_to(node.id, EdgeLabel.TRAVERSES) +
                    graph.edges_to(node.id, EdgeLabel.USES_HUB) +
                    graph.edges_to(node.id, EdgeLabel.CONNECTS)
                )
                if len(converging) >= self.GEO_LANE_MIN:
                    scores.append(min(len(converging) / 6.0, 1.0))
                    reasons.append(f"Geographic bottleneck: {len(converging)} routes converge")

            # 5. Signal convergence
            if sig_count >= self.SIGNAL_CONVERGENCE_MIN:
                scores.append(min(sig_count / 5.0, 1.0))
                reasons.append(f"Signal convergence: {sig_count} live signals")

            # 6. Direct order exposure
            if order_ids:
                scores.append(min(len(order_ids) / 4.0, 0.85))
                reasons.append(f"Direct order exposure: {len(order_ids)} customer orders at risk")

            if not scores:
                continue

            composite = round(sum(scores) / max(len(scores), 1), 4)
            profiles.append(ChokepointProfile(
                node_id=node.id,
                node_kind=node.kind,
                chokepoint_score=composite,
                severity=Severity.from_score(composite).value,
                reasons=reasons,
                downstream_count=len(downstream),
                order_count=len(order_ids),
                sku_count=len(sku_ids),
                has_alternates=bool(alts),
                signal_count=sig_count,
            ))

        return sorted(profiles, key=lambda p: -p.chokepoint_score)

    def apply(self, graph: OntologyGraph, profiles: list[ChokepointProfile]) -> None:
        """Stamp chokepoint metadata onto graph nodes (reset first)."""
        for n in graph.all_nodes:
            n.is_chokepoint = False
            n.chokepoint_score = 0.0
            n.chokepoint_profile = None
        for p in profiles:
            n = graph.node(p.node_id)
            if n:
                n.is_chokepoint = True
                n.chokepoint_score = p.chokepoint_score
                n.chokepoint_profile = p


# ==========================================================================
# Relationship Inferencer
# ==========================================================================

class RelationshipInferencer:
    """Creates and updates NL-labeled edges after every ingestion event.

    Produces edges for:
      DISRUPTS / AFFECTS       signal -> node  (by intensity threshold)
      CORROBORATES             signal -> signal (shared target)
      ALTERNATIVE_TO           alternate -> primary (BOM alternates)
      REPLACES                 alternate -> chokepoint primary
      BLOCKS                   chokepoint -> lane  (route would block)
      AMPLIFIES                chokepoint -> chokepoint (co-located)
      ROUTES_THROUGH           supplier -> chokepoint  (path passes through)
      CONCENTRATES_RISK        chokepoint -> region    (high HHI)
    """

    _DISRUPT_THRESHOLD = 0.60

    def _eid(self, src: str, tgt: str, label: str) -> str:
        return f"{src}|{label}|{tgt}"

    def infer(
        self,
        graph: OntologyGraph,
        signals: list,
        state: object,
    ) -> list[OntologyEdge]:
        created: list[OntologyEdge] = []
        created.extend(self._signal_to_node(graph, signals))
        created.extend(self._signal_corroboration(graph, signals))
        created.extend(self._bom_alternates(graph, state))
        created.extend(self._chokepoint_blocks(graph))
        created.extend(self._chokepoint_amplifies(graph))
        created.extend(self._routes_through(graph))
        created.extend(self._concentrates_risk(graph, state))
        return created

    def _signal_to_node(
        self, graph: OntologyGraph, signals: list
    ) -> list[OntologyEdge]:
        edges: list[OntologyEdge] = []
        for sig in signals:
            sig_nid = f"signal:{sig.id}"
            graph.upsert_node(OntologyNode(
                id=sig_nid, kind=NodeKind.RISK_SIGNAL,
                name=f"{sig.type} [{sig.source}]",
                lat=sig.lat, lon=sig.lon,
                properties={
                    "type": sig.type, "source": sig.source,
                    "intensity": sig.intensity, "confidence": sig.confidence,
                    "credibility": sig.credibility,
                    "observed_at": (sig.observed_at.isoformat()
                                    if hasattr(sig.observed_at, "isoformat")
                                    else str(sig.observed_at)),
                },
            ))
            for entity in getattr(sig, "entities", []):
                target = graph.node(entity.id)
                if not target:
                    continue
                label = (EdgeLabel.DISRUPTS
                         if sig.intensity >= self._DISRUPT_THRESHOLD
                         else EdgeLabel.AFFECTS)
                sev = round(sig.intensity * entity.match_confidence, 4)
                edge = OntologyEdge(
                    id=self._eid(sig_nid, entity.id, label),
                    source_id=sig_nid, target_id=entity.id,
                    label=label, severity=sev, confidence=sig.confidence,
                    propagation_probability=min(0.95, 0.65 + sev * 0.30),
                    impact_multiplier=min(0.90, sev),
                    properties={"signal_type": sig.type, "source": sig.source,
                                "match_confidence": entity.match_confidence},
                    provenance=[sig.source],
                )
                graph.upsert_edge(edge)
                edges.append(edge)
            # Geo-fallback
            if not getattr(sig, "entities", []) and sig.lat is not None:
                nid = graph.nearest_node(
                    sig.lat, sig.lon,
                    kinds=[NodeKind.SUPPLIER, NodeKind.PORT, NodeKind.HUB],
                )
                if nid:
                    label = (EdgeLabel.DISRUPTS
                             if sig.intensity >= self._DISRUPT_THRESHOLD
                             else EdgeLabel.AFFECTS)
                    edge = OntologyEdge(
                        id=self._eid(sig_nid, nid, label),
                        source_id=sig_nid, target_id=nid,
                        label=label, severity=sig.intensity,
                        confidence=round(sig.confidence * 0.70, 4),
                        propagation_probability=0.70,
                        impact_multiplier=sig.intensity * 0.70,
                        properties={"match_method": "geographic_proximity"},
                        provenance=[sig.source],
                    )
                    graph.upsert_edge(edge)
                    edges.append(edge)
        return edges

    def _signal_corroboration(
        self, graph: OntologyGraph, signals: list
    ) -> list[OntologyEdge]:
        edges: list[OntologyEdge] = []
        entity_sigs: dict[str, list[str]] = {}
        for sig in signals:
            sig_nid = f"signal:{sig.id}"
            for entity in getattr(sig, "entities", []):
                entity_sigs.setdefault(entity.id, []).append(sig_nid)
        for entity_id, sig_ids in entity_sigs.items():
            if len(sig_ids) < 2:
                continue
            for i, s1 in enumerate(sig_ids):
                for s2 in sig_ids[i + 1:]:
                    if not graph.node(s1) or not graph.node(s2):
                        continue
                    e = OntologyEdge(
                        id=self._eid(s1, s2, EdgeLabel.CORROBORATES),
                        source_id=s1, target_id=s2,
                        label=EdgeLabel.CORROBORATES,
                        severity=0.0, confidence=0.80,
                        properties={"shared_entity": entity_id},
                        provenance=["inference:corroboration"],
                    )
                    graph.upsert_edge(e)
                    edges.append(e)
        return edges

    def _bom_alternates(
        self, graph: OntologyGraph, state: object
    ) -> list[OntologyEdge]:
        edges: list[OntologyEdge] = []
        for bom_edge in getattr(state, "bom_edges", []):
            prim_id = bom_edge.upstream_id
            for alt_id in getattr(bom_edge, "approved_alternate_ids", []):
                if not graph.node(alt_id) or not graph.node(prim_id):
                    continue
                e1 = OntologyEdge(
                    id=self._eid(alt_id, prim_id, EdgeLabel.ALTERNATIVE_TO),
                    source_id=alt_id, target_id=prim_id,
                    label=EdgeLabel.ALTERNATIVE_TO, severity=0.0, confidence=1.0,
                    properties={"downstream_id": bom_edge.downstream_id,
                                "lead_time_days": bom_edge.lead_time_days},
                    provenance=["bom_ingestion"],
                )
                graph.upsert_edge(e1)
                edges.append(e1)
                prim = graph.node(prim_id)
                if prim and prim.is_chokepoint:
                    e2 = OntologyEdge(
                        id=self._eid(alt_id, prim_id, EdgeLabel.REPLACES),
                        source_id=alt_id, target_id=prim_id,
                        label=EdgeLabel.REPLACES, severity=prim.chokepoint_score,
                        confidence=0.90,
                        properties={"context": "chokepoint_disruption"},
                        provenance=["chokepoint_inference"],
                    )
                    graph.upsert_edge(e2)
                    edges.append(e2)
        return edges

    def _chokepoint_blocks(self, graph: OntologyGraph) -> list[OntologyEdge]:
        edges: list[OntologyEdge] = []
        for cp in graph.chokepoints():
            for in_edge in (graph.edges_to(cp.id, EdgeLabel.TRAVERSES) +
                            graph.edges_to(cp.id, EdgeLabel.USES_HUB)):
                lane = graph.node(in_edge.source_id)
                if not lane or lane.kind not in (NodeKind.LANE, NodeKind.TRADE_ROUTE):
                    continue
                e = OntologyEdge(
                    id=self._eid(cp.id, lane.id, EdgeLabel.BLOCKS),
                    source_id=cp.id, target_id=lane.id,
                    label=EdgeLabel.BLOCKS,
                    severity=cp.chokepoint_score, confidence=0.88,
                    propagation_probability=cp.chokepoint_score,
                    impact_multiplier=0.80,
                    properties={"reason": "chokepoint_on_route"},
                    provenance=["chokepoint_inference"],
                )
                graph.upsert_edge(e)
                edges.append(e)
        return edges

    def _chokepoint_amplifies(self, graph: OntologyGraph) -> list[OntologyEdge]:
        edges: list[OntologyEdge] = []
        region_cps: dict[str, list[OntologyNode]] = {}
        for cp in graph.chokepoints():
            r = cp.region or cp.properties.get("country", "unknown")
            region_cps.setdefault(r, []).append(cp)
        for region, cps in region_cps.items():
            if len(cps) < 2:
                continue
            for i, cp1 in enumerate(cps):
                for cp2 in cps[i + 1:]:
                    amp_sev = round((cp1.chokepoint_score + cp2.chokepoint_score) / 2.0, 4)
                    e = OntologyEdge(
                        id=self._eid(cp1.id, cp2.id, EdgeLabel.AMPLIFIES),
                        source_id=cp1.id, target_id=cp2.id,
                        label=EdgeLabel.AMPLIFIES,
                        severity=amp_sev, confidence=0.70,
                        properties={"region": region, "reason": "co_located_chokepoints"},
                        provenance=["chokepoint_inference"],
                    )
                    graph.upsert_edge(e)
                    edges.append(e)
        return edges

    def _routes_through(self, graph: OntologyGraph) -> list[OntologyEdge]:
        edges: list[OntologyEdge] = []
        cp_ids = {cp.id for cp in graph.chokepoints()}
        for sup in graph.nodes_by_kind(NodeKind.SUPPLIER):
            reachable = {nid for nid, _ in graph.downstream_nodes(sup.id, max_hops=8)}
            for cp_id in reachable & cp_ids:
                cp = graph.node(cp_id)
                e = OntologyEdge(
                    id=self._eid(sup.id, cp_id, EdgeLabel.ROUTES_THROUGH),
                    source_id=sup.id, target_id=cp_id,
                    label=EdgeLabel.ROUTES_THROUGH,
                    severity=cp.chokepoint_score if cp else 0.0,
                    confidence=0.80,
                    properties={"supply_path": "inferred_bfs"},
                    provenance=["graph_inference"],
                )
                graph.upsert_edge(e)
                edges.append(e)
        return edges

    def _concentrates_risk(
        self, graph: OntologyGraph, state: object
    ) -> list[OntologyEdge]:
        from .math_engine import concentration_score
        edges: list[OntologyEdge] = []
        total_spend = sum(m.spend for m in getattr(state, "supplier_metrics", [])) or 1.0
        spend_map: dict[str, float] = {}
        for m in getattr(state, "supplier_metrics", []):
            spend_map[m.supplier_id] = spend_map.get(m.supplier_id, 0.0) + m.spend

        region_items: dict[str, list[tuple[str, float]]] = {}
        for cp in graph.chokepoints():
            r = cp.region or "unknown"
            share = spend_map.get(cp.id, 0.0) / total_spend
            region_items.setdefault(r, []).append((cp.id, share))

        for region, items in region_items.items():
            shares = [s for _, s in items]
            hhi = concentration_score(shares)
            if hhi < 0.25:
                continue
            region_nid = f"region:{region}"
            if not graph.node(region_nid):
                graph.upsert_node(OntologyNode(
                    id=region_nid, kind=NodeKind.REGION, name=region,
                ))
            top_id, top_share = max(items, key=lambda x: x[1])
            e = OntologyEdge(
                id=self._eid(top_id, region_nid, EdgeLabel.CONCENTRATES_RISK),
                source_id=top_id, target_id=region_nid,
                label=EdgeLabel.CONCENTRATES_RISK,
                severity=round(hhi, 4), confidence=0.85,
                properties={"hhi": round(hhi, 4), "region": region,
                            "top_share": round(top_share, 4)},
                provenance=["concentration_inference"],
            )
            graph.upsert_edge(e)
            edges.append(e)
        return edges


# ==========================================================================
# Factory
# ==========================================================================

def build_ontology_graph(
    suppliers: list,
    parts: list,
    skus: list,
    orders: list,
    bom_edges: list,
    lanes: list,
    inventory_map: dict,
) -> OntologyGraph:
    """Build a fresh OntologyGraph from current operational state.

    Structural edges (SUPPLIES, CONSUMES, FULFILLS, TRAVERSES, CONNECTS,
    LOCATED_IN, DEPENDS_ON) are created here.

    Risk edges (DISRUPTS, CORROBORATES, BLOCKS, AMPLIFIES, ROUTES_THROUGH,
    CONCENTRATES_RISK) are added by RelationshipInferencer after signals arrive.

    Chokepoint flags are stamped by ChokepointExtractor after the graph is built.
    """
    g = OntologyGraph()

    def _eid(src: str, tgt: str, lbl: str) -> str:
        return f"{src}|{lbl}|{tgt}"

    # Suppliers
    for sup in suppliers:
        inv = inventory_map.get(sup.id)
        g.add_node(OntologyNode(
            id=sup.id, kind=NodeKind.SUPPLIER, name=sup.name,
            criticality=sup.criticality, lat=sup.lat, lon=sup.lon,
            region=sup.region,
            inventory_days=inv.days_cover if inv else None,
            properties={"tier": sup.tier, "country": sup.country,
                        "categories": sup.categories},
        ))
        if sup.region:
            rid = f"region:{sup.region}"
            if not g.node(rid):
                g.add_node(OntologyNode(id=rid, kind=NodeKind.REGION, name=sup.region))
            g.upsert_edge(OntologyEdge(
                id=_eid(sup.id, rid, EdgeLabel.LOCATED_IN),
                source_id=sup.id, target_id=rid,
                label=EdgeLabel.LOCATED_IN, severity=0.0, confidence=1.0,
                provenance=["operational_ingestion"],
            ))

    # Parts
    for part in parts:
        inv = inventory_map.get(part.id)
        g.add_node(OntologyNode(
            id=part.id, kind=NodeKind.PART, name=part.name,
            criticality=part.criticality,
            inventory_days=inv.days_cover if inv else None,
            properties={"category": part.category},
        ))
        if g.node(part.supplier_id):
            crit = part.criticality
            g.upsert_edge(OntologyEdge(
                id=_eid(part.supplier_id, part.id, EdgeLabel.SUPPLIES),
                source_id=part.supplier_id, target_id=part.id,
                label=EdgeLabel.SUPPLIES, severity=0.0, confidence=1.0,
                propagation_probability=min(0.95, 0.70 + crit * 0.25),
                impact_multiplier=min(0.90, 0.50 + crit * 0.40),
                provenance=["operational_ingestion"],
            ))

    # SKUs
    for sku in skus:
        inv = inventory_map.get(sku.id)
        g.add_node(OntologyNode(
            id=sku.id, kind=NodeKind.SKU, name=sku.name,
            inventory_days=inv.days_cover if inv else None,
            properties={"daily_demand": sku.daily_demand},
        ))
        for part_id in sku.parts:
            if g.node(part_id):
                g.upsert_edge(OntologyEdge(
                    id=_eid(part_id, sku.id, EdgeLabel.CONSUMES),
                    source_id=part_id, target_id=sku.id,
                    label=EdgeLabel.CONSUMES, severity=0.0, confidence=1.0,
                    propagation_probability=0.80, impact_multiplier=0.65,
                    provenance=["operational_ingestion"],
                ))

    # Orders
    for order in orders:
        g.add_node(OntologyNode(
            id=order.id, kind=NodeKind.CUSTOMER_ORDER, name=order.id,
            criticality=1.0 if order.priority == "high" else 0.5,
            properties={"sku_id": order.sku_id, "quantity": order.quantity,
                        "priority": order.priority},
        ))
        if g.node(order.sku_id):
            g.upsert_edge(OntologyEdge(
                id=_eid(order.sku_id, order.id, EdgeLabel.FULFILLS),
                source_id=order.sku_id, target_id=order.id,
                label=EdgeLabel.FULFILLS, severity=0.0, confidence=1.0,
                propagation_probability=0.90, impact_multiplier=0.80,
                provenance=["operational_ingestion"],
            ))

    # Lanes + hubs
    for lane in lanes:
        g.add_node(OntologyNode(
            id=lane.id, kind=NodeKind.LANE, name=lane.name,
            properties={"transit_days": lane.transit_days,
                        "from_hub": lane.from_hub, "to_hub": lane.to_hub},
        ))
        for hub_id in (lane.from_hub, lane.to_hub):
            if not g.node(hub_id):
                g.add_node(OntologyNode(id=hub_id, kind=NodeKind.PORT, name=hub_id))
            g.upsert_edge(OntologyEdge(
                id=_eid(lane.id, hub_id, EdgeLabel.TRAVERSES),
                source_id=lane.id, target_id=hub_id,
                label=EdgeLabel.TRAVERSES, severity=0.0, confidence=1.0,
                propagation_probability=0.85, impact_multiplier=0.65,
                provenance=["operational_ingestion"],
            ))
        if g.node(lane.from_hub) and g.node(lane.to_hub):
            g.upsert_edge(OntologyEdge(
                id=_eid(lane.from_hub, lane.to_hub, EdgeLabel.CONNECTS),
                source_id=lane.from_hub, target_id=lane.to_hub,
                label=EdgeLabel.CONNECTS, severity=0.0, confidence=1.0,
                propagation_probability=0.88, impact_multiplier=0.70,
                properties={"via_lane": lane.id, "transit_days": lane.transit_days},
                provenance=["operational_ingestion"],
            ))

    # BOM edges: DEPENDS_ON for any remaining cross-type links not yet covered
    semantic_labels = (EdgeLabel.SUPPLIES, EdgeLabel.CONSUMES, EdgeLabel.FULFILLS)
    for bom_edge in bom_edges:
        up = g.node(bom_edge.upstream_id)
        dn = g.node(bom_edge.downstream_id)
        if not up or not dn:
            continue
        if any(g.find_edge(bom_edge.upstream_id, bom_edge.downstream_id, lbl)
               for lbl in semantic_labels):
            continue
        crit = max(up.criticality, dn.criticality)
        g.upsert_edge(OntologyEdge(
            id=_eid(bom_edge.upstream_id, bom_edge.downstream_id, EdgeLabel.DEPENDS_ON),
            source_id=bom_edge.upstream_id, target_id=bom_edge.downstream_id,
            label=EdgeLabel.DEPENDS_ON, severity=0.0, confidence=1.0,
            propagation_probability=min(0.95, 0.65 + crit * 0.30),
            impact_multiplier=min(0.90, 0.50 + crit * 0.40),
            properties={"lead_time_days": bom_edge.lead_time_days,
                        "quantity": bom_edge.quantity},
            provenance=["operational_ingestion"],
        ))

    # 7. Seed top chokepoints & relations from Paqshi archive
    import json
    from pathlib import Path
    seed_path = Path(__file__).parent / "paqshi_seed.json"
    if seed_path.exists():
        try:
            with open(seed_path, "r", encoding="utf-8") as f:
                pdata = json.load(f)
            # Add top chokepoints
            for cp in pdata.get("chokepoints", []):
                cid = cp.get("id")
                if not cid:
                    continue
                node = g.node(cid)
                props = {
                    "category": cp.get("category"),
                    "subcategory": cp.get("subcategory"),
                    "country": cp.get("country"),
                    "baseline_stress": cp.get("baseline_stress"),
                    "baseline_vessels_day": cp.get("baseline_vessels_day"),
                    "throughput_pct": cp.get("throughput_pct"),
                    "epistemic_status": cp.get("epistemic_status"),
                    "key_commodities": cp.get("key_commodities"),
                    "delay_days": cp.get("delay_days"),
                    "stress_level": cp.get("stress_level"),
                    "source": "paqshi_archive",
                }
                if not node:
                    g.add_node(OntologyNode(
                        id=cid,
                        kind=NodeKind.CHOKEPOINT.value,
                        name=cp.get("name") or cid,
                        criticality=float(cp.get("criticality") or 0.5),
                        lat=cp.get("latitude"),
                        lon=cp.get("longitude"),
                        is_chokepoint=True,
                        chokepoint_score=float(cp.get("stress_level") or 0.35),
                        properties=props,
                    ))
                else:
                    node.is_chokepoint = True
                    if cp.get("stress_level") is not None:
                        node.chokepoint_score = float(cp.get("stress_level"))
                    if cp.get("criticality") is not None:
                        node.criticality = float(cp.get("criticality"))
                    if cp.get("latitude") and not node.lat:
                        node.lat = cp.get("latitude")
                        node.lon = cp.get("longitude")
                    if not isinstance(node.properties, dict):
                        node.properties = {}
                    node.properties.update({k: v for k, v in props.items() if v is not None})

            # Add top relations
            for rel in pdata.get("relations", []):
                from_cp = rel.get("from_cp")
                to_cp = rel.get("to_cp")
                if not from_cp or not to_cp:
                    continue
                for nid in (from_cp, to_cp):
                    if not g.node(nid):
                        g.add_node(OntologyNode(
                            id=nid,
                            kind=NodeKind.CHOKEPOINT.value,
                            name=nid.replace("cp.", "").replace("_", " ").title(),
                            is_chokepoint=True,
                            chokepoint_score=0.35,
                        ))
                
                rtype = rel.get("relation_type", "geographic")
                weight = float(rel.get("weight") or 0.3)
                if rtype == "disrupts" or weight >= 0.6:
                    lbl = EdgeLabel.DISRUPTS.value
                elif rtype == "blocks" or weight >= 0.5:
                    lbl = EdgeLabel.BLOCKS.value
                elif rtype == "amplifies" or weight >= 0.35:
                    lbl = EdgeLabel.AMPLIFIES.value
                else:
                    lbl = EdgeLabel.AFFECTS.value

                rel_id = rel.get("id") or _eid(from_cp, to_cp, lbl)
                g.upsert_edge(OntologyEdge(
                    id=rel_id,
                    source_id=from_cp,
                    target_id=to_cp,
                    label=lbl,
                    severity=weight,
                    confidence=0.88,
                    properties={
                        "relation_type": rtype,
                        "label": rel.get("label"),
                        "metadata": rel.get("metadata"),
                        "source": "paqshi_archive",
                    },
                    provenance=["paqshi_archive"],
                ))
        except Exception:
            pass

    return g
