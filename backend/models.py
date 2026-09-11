"""Pydantic v2 data contracts for SupplyChain Sentinel.

All schemas match docs/IO_CONTRACT.md and docs/BACKEND_SPEC.md.
The frontend must never calculate risk scores from display values —
every score is computed here on the backend and returned as data.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Signal ingestion
# ---------------------------------------------------------------------------

class EntityMatch(BaseModel):
    """An entity identified within a raw signal (entity resolution result)."""
    kind: str                                           # port | supplier | lane | part ...
    id: str                                             # graph node ID
    match_confidence: float = Field(ge=0.0, le=1.0)


class RiskSignal(BaseModel):
    """Canonical normalised risk signal.  Schema: docs/IO_CONTRACT.md section Signal ingestion."""
    id: str = Field(default_factory=_new_id)
    type: str                                           # weather_advisory | port_congestion | ...
    source: str
    source_url: str | None = None
    observed_at: datetime
    ingested_at: datetime = Field(default_factory=_utcnow)
    lat: float | None = None
    lon: float | None = None
    geometry: dict[str, Any] | None = None
    entities: list[EntityMatch] = Field(default_factory=list)
    intensity: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    credibility: float = Field(ge=0.0, le=1.0, default=0.8)
    raw_payload_hash: str | None = None


# ---------------------------------------------------------------------------
# Operational entity models
# ---------------------------------------------------------------------------

class Supplier(BaseModel):
    id: str
    name: str
    tier: int = 1
    country: str = ""
    region: str = ""
    lat: float | None = None
    lon: float | None = None
    categories: list[str] = Field(default_factory=list)
    criticality: float = Field(ge=0.0, le=1.0, default=0.5)


class Part(BaseModel):
    id: str
    name: str
    supplier_id: str
    category: str = ""
    criticality: float = Field(ge=0.0, le=1.0, default=0.5)


class SKU(BaseModel):
    id: str
    name: str
    parts: list[str] = Field(default_factory=list)      # Part IDs consumed
    daily_demand: float = 0.0


class CustomerOrder(BaseModel):
    id: str
    sku_id: str
    quantity: float
    required_date: datetime | None = None
    priority: str = "normal"                             # high | normal | low


class BomEdge(BaseModel):
    """Directed dependency: upstream_id -> downstream_id.

    Schema: docs/IO_CONTRACT.md section Operational ingestion.
    """
    upstream_id: str
    downstream_id: str
    quantity: float = 1.0
    lead_time_days: float = 14.0
    approved_alternate_ids: list[str] = Field(default_factory=list)


class InventoryPosition(BaseModel):
    """Node-level on-hand / demand / safety-stock snapshot."""
    node_id: str
    on_hand: float
    daily_demand: float
    safety_stock: float = 0.0

    @property
    def days_cover(self) -> float:
        """Remaining days of inventory cover above safety stock."""
        denom = max(self.daily_demand, 1e-6)
        return max(0.0, (self.on_hand - self.safety_stock) / denom)


class Lane(BaseModel):
    id: str
    name: str
    from_hub: str
    to_hub: str
    transit_days: float
    carrier_ids: list[str] = Field(default_factory=list)
    alternate_lane_ids: list[str] = Field(default_factory=list)


class Shipment(BaseModel):
    id: str
    lane_id: str
    supplier_id: str
    sku_id: str | None = None
    order_id: str | None = None
    departed_at: datetime | None = None
    expected_arrival: datetime | None = None
    status: str = "in_transit"                          # in_transit | delivered | delayed | cancelled


class SupplierMetric(BaseModel):
    """Per-period supplier performance record.  Schema: docs/BACKEND_SPEC.md section Data contracts."""
    supplier_id: str
    metric_date: datetime
    on_time_delivery: float = Field(ge=0.0, le=1.0)    # ratio of on-time deliveries
    quality_ppm: float = Field(ge=0.0)                  # defects per million units
    defect_rate: float = Field(ge=0.0, le=1.0)
    capacity_utilization: float = Field(ge=0.0, le=1.0)
    financial_score: float = Field(ge=0.0, le=1.0)     # 0 = high risk, 1 = financially healthy
    compliance_events: int = 0                          # number of violations in the period
    spend: float = 0.0                                  # total spend in the period (home currency)
    lead_time_days: float = 14.0


class OperationalIngestion(BaseModel):
    """Batch upsert for all operational entity types.  POST /v1/ingest/operational."""
    suppliers: list[Supplier] = Field(default_factory=list)
    supplier_metrics: list[SupplierMetric] = Field(default_factory=list)
    parts: list[Part] = Field(default_factory=list)
    skus: list[SKU] = Field(default_factory=list)
    bom_edges: list[BomEdge] = Field(default_factory=list)
    lanes: list[Lane] = Field(default_factory=list)
    shipments: list[Shipment] = Field(default_factory=list)
    inventory_positions: list[InventoryPosition] = Field(default_factory=list)
    orders: list[CustomerOrder] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Scoring output models
# ---------------------------------------------------------------------------

class FactorEntry(BaseModel):
    """A single auditable contribution to a score dimension."""
    name: str
    value: float
    contribution: float     # signed contribution to the composite score (percentage points)
    source: str = "internal"


class DimensionScore(BaseModel):
    """One scored dimension within a composite supplier risk score."""
    name: str
    raw_value: float        # normalised [0, 1] where 1 = highest risk
    normalized_score: float
    weight: float
    factor_ledger: list[FactorEntry] = Field(default_factory=list)


class SupplierRiskScore(BaseModel):
    """Full supplier risk output.  Schema: docs/BACKEND_SPEC.md section Data contracts."""
    supplier_id: str
    as_of: datetime
    score_0_100: float      # 100 = highest risk
    dimension_scores: list[DimensionScore]
    delta_7d: float | None = None   # positive = risk increased this week
    confidence: float               # [0,1] based on data coverage
    factor_ledger: list[FactorEntry] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    """One log-likelihood contribution to an alert posterior."""
    name: str
    llr: float
    weight: float
    source: str
    confidence: float
    contribution: float


class AlertCard(BaseModel):
    """Ranked alert with full evidence ledger.  Schema: docs/IO_CONTRACT.md section Read APIs."""
    id: str = Field(default_factory=_new_id)
    subject_id: str                  # graph node ID (port, supplier, lane ...)
    subject_kind: str
    alert_type: str
    posterior: float                 # P(disruption | evidence)
    prior: float
    severity: float                  # [0, 100] = probability x impact x urgency x concentration
    p50_days: float | None = None
    p80_days: float | None = None
    p95_days: float | None = None
    sku_count: int = 0
    order_count: int = 0
    evidence_ledger: list[EvidenceItem] = Field(default_factory=list)
    as_of: datetime = Field(default_factory=_utcnow)
    confidence: float = 0.8
    provenance: list[str] = Field(default_factory=list)


class Exposure(BaseModel):
    """Per-node exposure record from BOM graph traversal.  Schema: docs/BACKEND_SPEC.md."""
    alert_id: str
    entity_type: str
    entity_id: str
    hop: int                         # graph distance from disrupted seed node
    probability: float               # posterior x propagation_decay^hop
    expected_delay_days: float
    inventory_days_cover: float | None = None
    expected_loss: float = 0.0
    explanation: list[str] = Field(default_factory=list)


class MitigationOption(BaseModel):
    """A ranked, explainable mitigation recommendation."""
    id: str = Field(default_factory=_new_id)
    type: str                        # reroute | expedite | inventory_reallocation | alternate_supplier
    description: str
    expected_delay_reduction: float  # days saved vs. do-nothing p50
    cost_impact: float               # relative cost premium [0, 1]
    p50_lead_time: float | None = None
    p95_lead_time: float | None = None
    assumptions: list[str] = Field(default_factory=list)
    requires_approval: bool = True


class ConcentrationEntry(BaseModel):
    """HHI-based concentration result for one category or region."""
    category: str                    # e.g. "region:Europe" or "category:electronics"
    hhi: float                       # Herfindahl-Hirschman Index [0, 1]
    top_supplier_id: str | None = None
    top_share: float = 0.0
    supplier_count: int = 0


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class StressTestRequest(BaseModel):
    """POST /v1/stress-tests.  Schema: docs/IO_CONTRACT.md section Read APIs."""
    target_id: str
    target_kind: str                 # supplier | port | lane
    trials: int = Field(default=500, ge=1, le=10_000)
    rng_seed: int = 7                # fixed seed for reproducible demo judging


class StressTestNodeResult(BaseModel):
    node_id: str
    node_kind: str
    probability_affected: float
    expected_impact: float
    p50_stockout_days: float | None = None
    p95_stockout_days: float | None = None


class StressTestResult(BaseModel):
    target_id: str
    target_kind: str
    trials: int
    rng_seed: int
    forced_failure: bool = True
    node_results: list[StressTestNodeResult]
    ranked_mitigations: list[MitigationOption] = Field(default_factory=list)
    as_of: datetime = Field(default_factory=_utcnow)


class MitigationCompareRequest(BaseModel):
    alert_id: str


class SignalIngestResponse(BaseModel):
    accepted: int
    deduplicated: int
    quarantined: int
    quarantine_reasons: list[str] = Field(default_factory=list)


class OperationalIngestResponse(BaseModel):
    suppliers_upserted: int
    parts_upserted: int
    skus_upserted: int
    orders_upserted: int
    inventory_updated: int
    bom_edges_updated: int
    lanes_updated: int
    shipments_updated: int
    metrics_recorded: int


# ---------------------------------------------------------------------------
# Generic API envelope
# ---------------------------------------------------------------------------

class ApiEnvelope(BaseModel, Generic[T]):
    """Every API response is wrapped in this envelope (docs/IO_CONTRACT.md)."""
    data: T
    as_of: datetime = Field(default_factory=_utcnow)
    model_version: str = "1.0.0"
    confidence: float | None = None
    provenance: list[str] = Field(default_factory=list)
