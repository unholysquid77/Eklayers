# SupplyChain Sentinel — product single source of truth

## 1. Purpose and scope

SupplyChain Sentinel is a two-page decision-support product for the hackathon's PS #3 and PS #9. It gives a planner an early, evidence-backed view of a disruption, traces its exposure to parts, suppliers, inventory and orders, and recommends the next action. It separately maintains an explainable score for supplier relationship health.

The demo must tell one coherent story: a weather, port, route, policy or supplier signal raises the probability of disruption; the graph identifies the affected SKU/order; the user can compare mitigations and see expected stock-out timing. It is not a generic OSINT platform, an ERP replacement, or an autonomous procurement system.

## 2. Users and success criteria

Primary users are supply planners, procurement managers and supplier-risk analysts. A successful demo lets them answer, in under two minutes: **what changed, why it matters to us, what is exposed, how certain is the forecast, and what should we do now?**

Success measures: top-five alerts have visible evidence; each high-severity alert maps to at least one SKU/order; every supplier score has factor contributions; forecast calibration and alert precision are retained; public advisories and weather can visibly alter risk; a one-node stress test yields a stock-out duration and ranked mitigations.

## 3. Two-page information architecture

| Page | Job | Primary visual | Required panels |
|---|---|---|---|
| `/command` | Discover and investigate external disruption risk | Paqshi globe with routes, ports, suppliers, hazard and congestion layers | layer controls, ranked alerts, evidence drawer, selected route/chokepoint card |
| `/risk` | Decide what to do about supplier and product exposure | Dense operational dashboard | KPI strip, supplier-risk table, BOM/order exposure, forecast fan, mitigation comparator, concentration and stress-test panels |

Use the Paqshi globe as visual infrastructure, but retain only supply-chain layers: maritime routes/vessels, ports/chokepoints, logistics events, weather/hazards, trade/compliance events and supplier locations. Remove surveillance, cyber, cameras, military, navigation and unrelated market panels from the product navigation.

## 4. Core domain model

The production graph must extend Paqshi's supply-chain ontology. Existing `TradeRoute`, `LogisticsHub`, `CriticalMaterial`, `LogisticsEvent`, `TradePolicy` and `LogisticsOrg` remain useful. Add tenant-scoped operational nodes: `Supplier`, `SupplierSite`, `Part`, `SKU`, `BOM`, `PurchaseOrder`, `CustomerOrder`, `InventoryPosition`, `Lane`, `Shipment`, `Carrier`, `RiskSignal`, `Alert`, and `Mitigation`.

Key relationships: `SUPPLIES`, `MAKES`, `CONSUMES`, `BOM_CONTAINS`, `FULFILLS`, `SHIPS_ON`, `TRAVERSES`, `USES_HUB`, `OPERATED_BY`, `AFFECTS`, `ALTERNATIVE_TO`, `HAS_INVENTORY`, and `DEPENDS_ON`. Every event has source provenance, geography, valid time, ingestion time, confidence and tenant boundary.

## 5. Risk logic

1. Ingest raw signals and operational transactions; deduplicate, normalize and geocode them. Mandatory signal families are logistics events, port/container traffic, weather/disaster feeds, public advisories, freight news, sanctions/trade controls, supplier delivery/quality/capacity and inventory/ERP data.
2. Link a signal to a supplier, site, hub, lane, material or policy using deterministic IDs first and entity resolution second.
3. Update an explainable Bayesian disruption posterior. Use source credibility, corroboration, freshness, intensity, historical analogs and substitute headroom as auditable log-odds contributions.
4. Use a state-space model (Kalman first; particle filter later) to produce a 14/30-day probability fan and revised lead-time distribution.
5. Traverse the BOM/supply graph and use Monte Carlo simulation to turn node/lane failure uncertainty into SKU, order and stock-out exposure distributions.
6. Score severity as probability × business impact × time urgency × concentration, with a false-alarm penalty based on resolved source and model calibration. Alerts that fail precision/minimum-sample policy are suppressed or lowered, never deleted.
7. Produce recommended actions only from available approved alternatives, expedite capacity and inventory policies. Show assumptions and expected impact; require human approval.

Supplier health is a separate 0–100 score (100 = highest risk) composed of delivery, quality, financial, capacity, compliance and concentration dimensions. Maintain a factor ledger rather than a black-box score. A sharply deteriorating score triggers review even before it crosses a static threshold.

## 6. Demo data and scenario

Seed a small realistic tenant: 8 suppliers, 12 parts, 4 SKUs, 3 customer orders, 4 ports/lanes and approved alternates. The recommended scenario is an official weather/public advisory and port-congestion event at Singapore (or a Suez-route closure), plus a supplier whose on-time delivery and quality worsen. The user should be able to toggle the event, inspect the affected BOM/order exposure, compare reroute vs expedite vs inventory reallocation, see p50/p80/p95 revised lead time, and run the loss-of-supplier/port/route stress test.

Use deterministic fixtures for judging. Live feeds may enrich the globe but must never be required for a working demo.

## 7. Stack and delivery boundary

Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4, MapLibre GL, Framer Motion and Lucide. Backend: Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy, PostgreSQL + PostGIS, Redis/Celery (or RQ), NetworkX, NumPy/SciPy and scikit-learn. For a local hackathon demo, SQLite can replace Postgres and background tasks can run in-process.

The imported Paqshi Brain is intentionally a starting point, not the finished UX. Preserve attribution/licensing and do not migrate secrets. Build the narrowed routes and API contract beside it, then delete unused panels only after the focused view is proven.
