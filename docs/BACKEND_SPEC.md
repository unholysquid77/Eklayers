# Backend specification

## Architecture

Build a Python service in `backend/` with FastAPI for the API, a scheduled ingestion worker, a scoring/forecast worker and a relational store. Use PostgreSQL/PostGIS in deployment; SQLite is acceptable for the demo. Store canonical transactions in relational tables and model the dependency graph in relational edge tables projected into NetworkX for each run. This keeps BOM traversals inspectable without needing a graph database during a hackathon.

Suggested packages: `fastapi`, `uvicorn`, `pydantic`, `sqlalchemy`, `alembic`, `httpx`, `feedparser`, `tenacity`, `apscheduler` or `celery`, `redis`, `numpy`, `scipy`, `pandas`, `networkx`, `scikit-learn`, `shapely`, `geopy`, `structlog`, `pytest` and `pytest-asyncio`. The initial pure-Python reference engine lives at `backend/math_engine.py`; it implements the core formulas independently of Paqshi's wider runtime.

## Paqshi sources to retain

| Priority | Paqshi source/module | Why retain it | Product use |
|---|---|---|---|
| P0 | `domains/supply_chain/.../supply_chain_sources.py` | World Bank exports, imports and container-port traffic | slow-moving trade/port baseline |
| P0 | `SupplyChainNewsIngestor`, `FreightWavesIngestor` | logistics disruption reporting | emergent disruption evidence |
| P0 | `data/layers/open_meteo.py`, `gdacs.py`, `usgs.py`, `nasa_firms.py` | weather, disaster, earthquake and wildfire signals | geographic hazard risk |
| P0 | `data/layers/nws.py`, `data/layers/ioda.py`, `data/layers/curated.py` | official public advisories and curated disruption notices | advisory corroboration and planner alerting |
| P1 | `data/layers/acled.py`, `data/ofac_loader.py`, `uk_sanctions_loader.py`, `eu_sanctions_loader.py` | unrest, sanctions and trade-policy shocks | geopolitical/compliance risk |
| P1 | Loadstar, Splash247, gCaptain, JOC, SupplyChainDive, LloydsList, ContainerNews, MaritimeExecutive, HellenicShipping, Drewry, SupplyChainBrain | curated shipping/freight corroboration | supporting evidence, source reliability tracking |
| P2 | `core/general_ingestor.py`, `api_ingestor.py`, `rss_ingestor.py`, `ingestor_health.py` | reusable ingestion lifecycle and source-health ideas | common adapter contract and monitoring |

Do not bring in Paqshi's CCTV, aircraft surveillance, cyber, social scraping, general finance, military or unrelated intelligence sources. AIS/port calls, carrier tracking, supplier ERP/QMS and order/inventory feeds are new adapters; for the demo, represent them with CSV/JSON fixtures and an upload endpoint.

## Data contracts

`RiskSignal`: `id, type, source, source_url, observed_at, ingested_at, lat, lon, geometry, entities[], intensity, confidence, credibility, raw_payload_hash`. The full request/response contract and formula I/O are in `docs/IO_CONTRACT.md`.

`SupplierMetric`: `supplier_id, metric_date, on_time_delivery, quality_ppm, defect_rate, capacity_utilization, financial_score, compliance_events, spend, lead_time_days`.

`Exposure`: `alert_id, entity_type, entity_id, hop, probability, expected_delay_days, inventory_days_cover, expected_loss, explanation[]`.

`SupplierRiskScore`: `supplier_id, as_of, score_0_100, dimension_scores, delta_7d, confidence, factor_ledger[]`.

## API surface

`GET /v1/map/layers`, `GET /v1/alerts`, `GET /v1/alerts/{id}`, `GET /v1/chokepoints/{id}/forecast`, `GET /v1/exposure?alert_id=`, `GET /v1/suppliers`, `GET /v1/suppliers/{id}/risk`, `GET /v1/concentration`, `POST /v1/stress-tests`, `POST /v1/mitigations/compare`, `POST /v1/ingest/signals`, `POST /v1/ingest/operational`, and `POST /v1/demo/reset` are sufficient. Return `{data, as_of, confidence, provenance}` consistently. The frontend must never calculate a risk score from display values.

## Ingestion and quality controls

All adapters implement `discover → fetch → extract → normalize → persist`. Save raw payload references and hash them, dedupe via source URL/hash plus semantic similarity, and preserve source reliability. Apply recency decay, geospatial/entity matching confidence and independent-source corroboration before scoring. Quarantine malformed or unresolvable data; never silently convert it into a high-risk alert. Track precision/recall after analyst disposition and down-weight sources with repeated false positives.

## Models derived from Paqshi mathint

Adopt `mathint/bayesian_updater.py`'s additive log-odds posterior and Beta uncertainty envelope for each disruption target. Adapt its base rates to route, port, supplier site and supplier. Calculate per-node stress from freshness-decayed signal intensity and confidence, using a bounded corroboration union; calculate priors by category, criticality and horizon. Use `mathint/ssm.py`'s Kalman state-space forecast on daily disruption probability and lead-time residual; emit p50/p80/p95 dates. Use `mathint/monte_carlo.py`'s graph propagation pattern with BOM and inventory edges to estimate exposed orders and days-to-stock-out. Start with 500 seeded trials for the demo, then use 3,000+ asynchronously in production. Calibrate with Brier score, reliability bins and alert precision. The exact reference formulas and fields are versioned in `docs/IO_CONTRACT.md`.

## Build order and tests

1. Seed fixtures and relational schema. 2. Implement operational upload + normalizer. 3. Add selected external adapters. 4. Implement graph exposure. 5. Implement Bayesian/SSM/Monte Carlo services. 6. Add alerts, score factors, mitigations and stress tests.

Unit-test normalization, entity links, factor arithmetic and deterministic seeded simulations. Contract-test every endpoint. Scenario-test that the seeded weather/advisory + port/supplier event creates the intended alert, maps to orders, revises lead times and changes its mitigation recommendation. Require tenant IDs and RBAC before accepting real supplier data.
