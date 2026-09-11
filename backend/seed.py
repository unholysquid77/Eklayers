"""Minimal startup seed for SupplyChain Sentinel.

This is NOT a fixed demo scenario.  It provides a small, generic operational
baseline (suppliers, parts, BOM, inventory, lanes) so the API can respond
meaningfully before live data arrives via POST /v1/ingest/*.

Live signals drive the alert pipeline entirely — no canned signals are seeded.
Users supply their own operational graph via POST /v1/ingest/operational.
"""
from __future__ import annotations

from datetime import datetime, timezone

from .models import (
    BomEdge,
    CustomerOrder,
    InventoryPosition,
    Lane,
    Part,
    SKU,
    Supplier,
    SupplierMetric,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Suppliers  (3 generic tier-1 suppliers across different regions)
# ---------------------------------------------------------------------------

SEED_SUPPLIERS: list[Supplier] = [
    Supplier(
        id="sup-alpha",
        name="Alpha Components GmbH",
        tier=1, country="DE", region="Europe",
        lat=52.52, lon=13.40,
        categories=["electronics"],
        criticality=0.70,
    ),
    Supplier(
        id="sup-beta",
        name="Beta Precision KK",
        tier=1, country="JP", region="Asia",
        lat=35.68, lon=139.69,
        categories=["mechanical"],
        criticality=0.55,
    ),
    Supplier(
        id="sup-gamma",
        name="Gamma Packaging Pte",
        tier=2, country="SG", region="SEA",
        lat=1.35, lon=103.82,
        categories=["packaging"],
        criticality=0.30,
    ),
]

# ---------------------------------------------------------------------------
# Parts
# ---------------------------------------------------------------------------

SEED_PARTS: list[Part] = [
    Part(id="part-ctrl",   name="Control Unit A",       supplier_id="sup-alpha", category="electronics", criticality=0.80),
    Part(id="part-mech",   name="Mechanical Assembly B", supplier_id="sup-beta",  category="mechanical",  criticality=0.60),
    Part(id="part-pkg",    name="Standard Carton",       supplier_id="sup-gamma", category="packaging",   criticality=0.20),
]

# ---------------------------------------------------------------------------
# SKUs
# ---------------------------------------------------------------------------

SEED_SKUS: list[SKU] = [
    SKU(id="sku-prod-x", name="Product X", parts=["part-ctrl", "part-mech", "part-pkg"], daily_demand=50.0),
    SKU(id="sku-prod-y", name="Product Y", parts=["part-ctrl", "part-pkg"],              daily_demand=30.0),
]

# ---------------------------------------------------------------------------
# Customer orders
# ---------------------------------------------------------------------------

SEED_ORDERS: list[CustomerOrder] = [
    CustomerOrder(id="ord-1001", sku_id="sku-prod-x", quantity=500, priority="high"),
    CustomerOrder(id="ord-1002", sku_id="sku-prod-y", quantity=300, priority="normal"),
]

# ---------------------------------------------------------------------------
# BOM edges  (supplier -> part -> sku -> order)
# ---------------------------------------------------------------------------

SEED_BOM_EDGES: list[BomEdge] = [
    # Supplier -> Part
    BomEdge(upstream_id="sup-alpha", downstream_id="part-ctrl",  quantity=1, lead_time_days=14),
    BomEdge(upstream_id="sup-beta",  downstream_id="part-mech",  quantity=1, lead_time_days=21),
    BomEdge(upstream_id="sup-gamma", downstream_id="part-pkg",   quantity=1, lead_time_days=7),
    # Part -> SKU
    BomEdge(upstream_id="part-ctrl", downstream_id="sku-prod-x", quantity=1, lead_time_days=2),
    BomEdge(upstream_id="part-mech", downstream_id="sku-prod-x", quantity=2, lead_time_days=2),
    BomEdge(upstream_id="part-pkg",  downstream_id="sku-prod-x", quantity=1, lead_time_days=1),
    BomEdge(upstream_id="part-ctrl", downstream_id="sku-prod-y", quantity=1, lead_time_days=2),
    BomEdge(upstream_id="part-pkg",  downstream_id="sku-prod-y", quantity=1, lead_time_days=1),
    # SKU -> Order
    BomEdge(upstream_id="sku-prod-x", downstream_id="ord-1001",  quantity=500, lead_time_days=3),
    BomEdge(upstream_id="sku-prod-y", downstream_id="ord-1002",  quantity=300, lead_time_days=3),
]

# ---------------------------------------------------------------------------
# Inventory positions
# ---------------------------------------------------------------------------

SEED_INVENTORY: list[InventoryPosition] = [
    InventoryPosition(node_id="part-ctrl",   on_hand=500,  daily_demand=80,  safety_stock=100),
    InventoryPosition(node_id="part-mech",   on_hand=300,  daily_demand=50,  safety_stock=75),
    InventoryPosition(node_id="part-pkg",    on_hand=2000, daily_demand=80,  safety_stock=200),
    InventoryPosition(node_id="sku-prod-x",  on_hand=200,  daily_demand=50,  safety_stock=50),
    InventoryPosition(node_id="sku-prod-y",  on_hand=150,  daily_demand=30,  safety_stock=30),
]

# ---------------------------------------------------------------------------
# Lanes  (generic global shipping lanes; not scenario-specific)
# ---------------------------------------------------------------------------

SEED_LANES: list[Lane] = [
    Lane(id="lane-asia-eu",     name="Asia -> Europe (Primary)",   from_hub="hub-singapore", to_hub="hub-rotterdam", transit_days=28, alternate_lane_ids=["lane-asia-eu-alt"]),
    Lane(id="lane-asia-eu-alt", name="Asia -> Europe (Alternate)", from_hub="hub-singapore", to_hub="hub-rotterdam", transit_days=35),
    Lane(id="lane-jp-sg",       name="Japan -> Singapore",         from_hub="hub-tokyo",     to_hub="hub-singapore", transit_days=5),
    Lane(id="lane-de-eu",       name="Germany -> EU Hub",          from_hub="hub-hamburg",   to_hub="hub-rotterdam", transit_days=2),
]

# ---------------------------------------------------------------------------
# Supplier metrics  (current-period baseline; live ingestion updates these)
# ---------------------------------------------------------------------------

SEED_SUPPLIER_METRICS: list[SupplierMetric] = [
    SupplierMetric(
        supplier_id="sup-alpha", metric_date=_utcnow(),
        on_time_delivery=0.94, quality_ppm=120,  defect_rate=0.012,
        capacity_utilization=0.72, financial_score=0.85, compliance_events=0,
        spend=420_000, lead_time_days=14,
    ),
    SupplierMetric(
        supplier_id="sup-beta", metric_date=_utcnow(),
        on_time_delivery=0.88, quality_ppm=350,  defect_rate=0.035,
        capacity_utilization=0.81, financial_score=0.72, compliance_events=1,
        spend=280_000, lead_time_days=21,
    ),
    SupplierMetric(
        supplier_id="sup-gamma", metric_date=_utcnow(),
        on_time_delivery=0.96, quality_ppm=80,   defect_rate=0.008,
        capacity_utilization=0.60, financial_score=0.88, compliance_events=0,
        spend=95_000,  lead_time_days=7,
    ),
]
