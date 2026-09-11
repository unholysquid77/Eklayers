"""Supply-chain dependency graph for SupplyChain Sentinel.

The graph is rebuilt from current operational state on every ingestion event.
Nodes represent operational entities (suppliers, parts, SKUs, orders, ports/hubs, lanes).
Directed edges represent disruption propagation paths with lead-time and probability metadata.

networkx is used when available for richer analysis; the core BFS traversal
uses plain Python dicts so the module works without it.
"""
from __future__ import annotations

from dataclasses import dataclass, field


try:
    import networkx as _nx          # optional; used for future advanced analytics
    _HAS_NX = True
except ImportError:
    _HAS_NX = False


# ---------------------------------------------------------------------------
# Node and edge metadata
# ---------------------------------------------------------------------------

@dataclass
class NodeMeta:
    id: str
    kind: str               # supplier | part | sku | order | port | lane
    criticality: float = 0.5
    inventory_days: float | None = None
    lat: float | None = None
    lon: float | None = None
    region: str = ""
    name: str = ""


@dataclass
class EdgeMeta:
    upstream_id: str
    downstream_id: str
    lead_time_days: float = 14.0
    propagation_probability: float = 0.85
    impact_multiplier: float = 0.65
    alternate_ids: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Graph class
# ---------------------------------------------------------------------------

class SupplyGraph:
    """Directed graph: upstream --disruption_propagates--> downstream.

    Designed for per-run rebuilding from relational tables; the graph is
    never persisted, keeping BOM traversals inspectable and repeatable.
    """

    def __init__(self) -> None:
        self._nodes: dict[str, NodeMeta] = {}
        self._edges: list[EdgeMeta] = []
        self._adj:  dict[str, list[EdgeMeta]] = {}   # upstream  -> outgoing edges
        self._radj: dict[str, list[EdgeMeta]] = {}   # downstream -> incoming edges

    # ------------------------------------------------------------------
    # Mutation
    # ------------------------------------------------------------------

    def add_node(self, meta: NodeMeta) -> None:
        self._nodes[meta.id] = meta

    def add_edge(self, edge: EdgeMeta) -> None:
        self._edges.append(edge)
        self._adj.setdefault(edge.upstream_id,   []).append(edge)
        self._radj.setdefault(edge.downstream_id, []).append(edge)

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------

    def node(self, node_id: str) -> NodeMeta | None:
        return self._nodes.get(node_id)

    @property
    def all_nodes(self) -> list[NodeMeta]:
        return list(self._nodes.values())

    @property
    def all_edges(self) -> list[EdgeMeta]:
        return list(self._edges)

    def nodes_by_kind(self, kind: str) -> list[NodeMeta]:
        return [n for n in self._nodes.values() if n.kind == kind]

    def edges_from(self, node_id: str) -> list[EdgeMeta]:
        return self._adj.get(node_id, [])

    def edges_to(self, node_id: str) -> list[EdgeMeta]:
        return self._radj.get(node_id, [])

    # ------------------------------------------------------------------
    # Traversal
    # ------------------------------------------------------------------

    def downstream_nodes(self, node_id: str, max_hops: int = 5) -> list[tuple[str, int]]:
        """BFS downstream.  Returns [(node_id, hop_distance)] excluding seed."""
        visited: dict[str, int] = {}
        queue: list[tuple[str, int]] = [(node_id, 0)]
        result: list[tuple[str, int]] = []
        while queue:
            current, hop = queue.pop(0)
            if current in visited:
                continue
            visited[current] = hop
            if current != node_id:
                result.append((current, hop))
            if hop < max_hops:
                for edge in self._adj.get(current, []):
                    if edge.downstream_id not in visited:
                        queue.append((edge.downstream_id, hop + 1))
        return result

    def upstream_nodes(self, node_id: str, max_hops: int = 5) -> list[tuple[str, int]]:
        """BFS upstream (trace root causes of a downstream impact)."""
        visited: dict[str, int] = {}
        queue: list[tuple[str, int]] = [(node_id, 0)]
        result: list[tuple[str, int]] = []
        while queue:
            current, hop = queue.pop(0)
            if current in visited:
                continue
            visited[current] = hop
            if current != node_id:
                result.append((current, hop))
            if hop < max_hops:
                for edge in self._radj.get(current, []):
                    if edge.upstream_id not in visited:
                        queue.append((edge.upstream_id, hop + 1))
        return result

    def find_alternates(self, node_id: str) -> list[str]:
        """Return approved alternate upstream IDs declared in incoming BOM edges."""
        alts: list[str] = []
        for edge in self._radj.get(node_id, []):
            alts.extend(edge.alternate_ids)
        return list(dict.fromkeys(alts))   # deduplicated, order-preserving

    # ------------------------------------------------------------------
    # Geo helpers
    # ------------------------------------------------------------------

    def nearest_node(self, lat: float, lon: float, kinds: list[str] | None = None) -> str | None:
        """Return the node ID closest to (lat, lon) using squared Euclidean distance."""
        best_id: str | None = None
        best_dist = float("inf")
        for node in self._nodes.values():
            if node.lat is None or node.lon is None:
                continue
            if kinds and node.kind not in kinds:
                continue
            dist = (node.lat - lat) ** 2 + (node.lon - lon) ** 2
            if dist < best_dist:
                best_dist = dist
                best_id = node.id
        return best_id

    # ------------------------------------------------------------------
    # Concentration helpers
    # ------------------------------------------------------------------

    def spend_shares_by_region(self, spend_map: dict[str, float]) -> dict[str, list[float]]:
        """Group supplier spend shares by region for HHI computation."""
        by_region: dict[str, list[float]] = {}
        for node in self.nodes_by_kind("supplier"):
            share = spend_map.get(node.id, 0.0)
            by_region.setdefault(node.region or "unknown", []).append(share)
        return by_region

    def spend_shares_by_category(self, spend_map: dict[str, float]) -> dict[str, list[float]]:
        """Group supplier spend shares by first category for HHI computation."""
        by_cat: dict[str, list[float]] = {}
        # Read categories from the raw supplier objects (stored in node.name placeholder)
        # The graph itself does not store categories; caller passes the mapping.
        return by_cat   # placeholder: populated by app.py using full Supplier objects


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def build_graph(
    suppliers: list,
    parts: list,
    skus: list,
    orders: list,
    bom_edges: list,
    lanes: list,
    inventory_map: dict,
) -> SupplyGraph:
    """Build a fresh SupplyGraph from the current operational state.

    Called on every POST /v1/ingest/* so the graph always reflects live data.
    """
    g = SupplyGraph()

    # --- Suppliers ---
    for sup in suppliers:
        inv = inventory_map.get(sup.id)
        g.add_node(NodeMeta(
            id=sup.id, kind="supplier",
            criticality=sup.criticality,
            inventory_days=inv.days_cover if inv else None,
            lat=sup.lat, lon=sup.lon,
            region=sup.region, name=sup.name,
        ))

    # --- Parts ---
    for part in parts:
        inv = inventory_map.get(part.id)
        g.add_node(NodeMeta(
            id=part.id, kind="part",
            criticality=part.criticality,
            inventory_days=inv.days_cover if inv else None,
            name=part.name,
        ))

    # --- SKUs ---
    for sku in skus:
        inv = inventory_map.get(sku.id)
        g.add_node(NodeMeta(
            id=sku.id, kind="sku",
            inventory_days=inv.days_cover if inv else None,
            name=sku.name,
        ))

    # --- Orders ---
    for order in orders:
        g.add_node(NodeMeta(
            id=order.id, kind="order",
            criticality=1.0 if order.priority == "high" else 0.5,
            name=order.id,
        ))

    # --- Lanes + implicit hub nodes ---
    for lane in lanes:
        g.add_node(NodeMeta(id=lane.id, kind="lane", name=lane.name))
        for hub_id in (lane.from_hub, lane.to_hub):
            if hub_id not in g._nodes:
                g.add_node(NodeMeta(id=hub_id, kind="port", name=hub_id))

    # --- BOM edges ---
    for edge in bom_edges:
        down = g.node(edge.downstream_id)
        # Higher criticality of the downstream node -> higher propagation probability
        base_prop = 0.70 + (down.criticality * 0.25 if down else 0.10)
        g.add_edge(EdgeMeta(
            upstream_id=edge.upstream_id,
            downstream_id=edge.downstream_id,
            lead_time_days=edge.lead_time_days,
            propagation_probability=min(base_prop, 0.95),
            impact_multiplier=0.65,
            alternate_ids=edge.approved_alternate_ids,
        ))

    return g
