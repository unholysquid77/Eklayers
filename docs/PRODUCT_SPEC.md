# Sarvadarshi — product single source of truth

## 1. Purpose and scope

Sarvadarshi is a two-page decision-support product for the hackathon's PS #3 (disruption prediction) and PS #9 (continuous supplier-risk scoring). It gives a planner an early, evidence-backed view of a disruption, traces its exposure to parts, suppliers, inventory and orders, and recommends the next action. It separately maintains an explainable score for supplier relationship health.

The demo tells one coherent story: a weather, port, route, policy or supplier signal raises the probability of disruption; the graph identifies the affected SKU/order; the user can compare mitigations and see expected stock-out timing. It is not a generic OSINT platform, an ERP replacement, or an autonomous procurement system.

## 2. Users and success criteria

Primary users are supply planners, procurement managers and supplier-risk analysts. A successful demo lets them answer, in under two minutes: **what changed, why it matters to us, what is exposed, how certain is the forecast, and what should we do now?**

Success measures: top-five alerts have visible evidence; each high-severity alert maps to at least one SKU/order; every supplier score has factor contributions; forecast calibration and alert precision are retained; public advisories and weather can visibly alter risk; a one-node stress test yields a stock-out duration and ranked mitigations.

## 3. Two-page information architecture

| Page | Job | Primary visual | Required panels |
|---|---|---|---|
| `/command` | Discover and investigate external disruption risk | Globe with ports, hazard zones, and route overlays | Alert sidebar, alert detail popup, Zulu clock, live data button, demo reset |
| `/risk` | Decide what to do about supplier and product exposure | Dense operational dashboard | Supplier list, risk score card (0-100), dimension bars, factor ledger, cascade exposure table, stress test buttons, concentration panel |

The globe uses MapLibre GL with the `dark-matter` basemap and supply-chain layers (ports, hazard zones, routes). No surveillance, cyber, cameras, military, or unrelated market panels.

## 4. Core domain model

### Operational nodes

`Supplier`, `Part`, `SKU`, `BOM`, `PurchaseOrder`, `CustomerOrder`, `InventoryPosition`, `Lane`, `Shipment`, `Carrier`, `RiskSignal`, `Alert`, `Mitigation`.

### Key relationships

`SUPPLIES`, `MAKES`, `CONSUMES`, `BOM_CONTAINS`, `FULFILLS`, `SHIPS_ON`, `TRAVERSES`, `USES_HUB`, `OPERATED_BY`, `AFFECTS`, `ALTERNATIVE_TO`, `HAS_INVENTORY`, `DEPENDS_ON`.

Every event has source provenance, geography, valid time, ingestion time, confidence and tenant boundary.

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

### Deterministic fixture data (`backend/fixtures.py`)

| Category | Count | Description |
|---|---|---|
| Signals | 11 | 3 weather (Tropical Storm Bolaven, USGS earthquake, GDACS Philippines typhoon), 3 logistics (Singapore port congestion, Suez route alert, Belgium labour strike), 5 supply-chain news (semiconductor shortage, tariff escalation, customs delays, East Coast port strike, rare earth disruption) |
| Locations | 10 | Major global ports with coordinates and hazard scores |
| Nodes | 15 | 5 suppliers (acme-electronics, precision-metals, shenzhen-semi, logistics-gmbh, reliable-circuits), 6 parts, 3 SKUs, 1 customer |
| Dependencies | 14 | Supply, assembly, manufacturing, and logistics relationships |

Seed with `POST /v1/demo/reset`.

## 7. Stack and delivery boundary

### Frontend

Next.js 16, React 19, TypeScript, Tailwind CSS 4, MapLibre GL, Framer Motion, Lucide. Client-side globe via `OsirisMap.tsx` with `next/dynamic`. State is local React hooks; no external state library.

### Backend

Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy, SQLite (for demo). Standard-library math engine (`math_engine.py`) with no external numerics. Live RSS/HTTP ingestion via `feedparser` and `httpx`. Deterministic fixtures via `fixtures.py`.

### Key architectural decisions

- SQLite replaces PostgreSQL for hackathon demo (zero config)
- RSS-first news ingestion with Google News fallback (no API keys needed for demo)
- Live fetch + fixture fallback for all external sources
- No Redis/Celery — background tasks run in-process
- No Tanstack Query, Zod, or Recharts — kept to vanilla React + Tailwind
