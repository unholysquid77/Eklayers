# Backend specification

## Architecture

Build a Python service in `backend/` with FastAPI for the API, a scheduled ingestion worker, a scoring/forecast worker and a relational store. Use SQLite for the hackathon demo (PostgreSQL/PostGIS in deployment). Store canonical transactions in relational tables and model the dependency graph in relational edge tables projected into NetworkX for each run.

### Packages

`fastapi`, `uvicorn`, `pydantic`, `sqlalchemy`, `httpx`, `feedparser`, `structlog`, `pytest`. The pure-Python reference engine lives at `backend/math_engine.py` with zero external numerics.

## Implemented files

| File | Purpose |
|---|---|
| `backend/math_engine.py` | Bayesian updater, Kalman lead-time, Monte Carlo exposure, node stress, prior calculation, false-alarm metrics |
| `backend/ingestion.py` | Source catalogue (`SOURCES` tuple) + `normalize_signal()` |
| `backend/sources.py` | Live adapters: OpenMeteo, GDACS, NWS, USGS, WorldBank, GoogleNews |
| `backend/pipeline.py` | `IngestionPipeline`, `SignalStore` (SQLite), `RunSummary` |
| `backend/fixtures.py` | Deterministic seed data: 11 signals, 10 locations, 15 nodes, 14 dependency edges |
| `backend/news_ingestors.py` | 12 supply-chain publishers with RSS-first + Google News fallback |
| `backend/app.py` | FastAPI app, 21 routes, CORS, envelope responses |
| `backend/demo.py` | Offline deterministic demo |
| `backend/run_ingestion.py` | CLI entry point |
| `backend/tests/test_math_engine.py` | 7 math engine tests (all passing) |

## Paqshi sources retained

| Priority | Source | Why | Product use |
|---|---|---|---|
| P0 | OpenMeteo | Weather forecasts, no API key needed | Geographic hazard risk |
| P0 | GDACS | Global Disaster Alert Coordination System | Disaster/hazard alerts |
| P0 | NWS (NOAA) | US National Weather Service | Official advisories |
| P0 | USGS | Earthquake data | Seismic hazard signals |
| P0 | World Bank | Container port traffic | Trade/port baseline |
| P0 | Google News | Fallback news discovery | Emergent disruption evidence |
| P0 | 12 RSS publishers | FreightWaves, Loadstar, Splash247, gCaptain, JOC, SupplyChainDive, Lloyd's List, ContainerNews, Maritime Executive, Hellenic Shipping, Drewry, SupplyChainBrain | Logistics disruption corroboration |

Do not bring in Paqshi's CCTV, aircraft surveillance, cyber, social scraping, military or unrelated intelligence sources.

## Data contracts

`RiskSignal`: `id, type, source, source_url, observed_at, ingested_at, lat, lon, geometry, entities[], intensity, confidence, credibility, raw_payload_hash`.

`SupplierMetric`: `supplier_id, metric_date, on_time_delivery, quality_ppm, defect_rate, capacity_utilization, financial_score, compliance_events, spend, lead_time_days`.

`Exposure`: `alert_id, entity_type, entity_id, hop, probability, expected_delay_days, inventory_days_cover, expected_loss, explanation[]`.

`SupplierRiskScore`: `supplier_id, as_of, score_0_100, dimension_scores, delta_7d, confidence, factor_ledger[]`.

## API surface

All responses use the envelope `{ "data": ..., "as_of": "...", "model_version": "...", "provenance": [...] }`.

### Alerts & disruption

| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/alerts` | Ranked alert queue with posteriors, evidence ledger |
| GET | `/v1/alerts/{id}` | Single alert detail |
| GET | `/v1/exposure?alert_id=` | Exposure graph/table for an alert |
| GET | `/v1/chokepoints/{id}/forecast` | Chokepoint disruption forecast |

### Suppliers & risk

| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/suppliers` | All suppliers with risk scores |
| GET | `/v1/suppliers/{id}/risk` | Detailed supplier risk (0-100), dimensions, factor ledger |
| GET | `/v1/concentration` | Concentration risk analysis |

### Stress tests & mitigations

| Method | Endpoint | Description |
|---|---|---|
| POST | `/v1/stress-tests` | Monte Carlo cascade simulation (500 trials, deterministic seed) |
| POST | `/v1/mitigations/compare` | Compare mitigation options |

### Ingestion & demo

| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/map/layers` | GeoJSON layers for globe |
| POST | `/v1/ingest/signals` | Ingest risk signals |
| POST | `/v1/ingest/operational` | Ingest operational data |
| POST | `/v1/ingest/live` | Trigger live fetch from all sources |
| POST | `/v1/demo/reset` | Reset to fixture data |
| POST | `/v1/demo/seed` | Seed fresh fixture data |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |

## Ingestion and quality controls

All adapters implement `discover → fetch → extract → normalize → persist`. Save raw payload references and hash them, dedupe via source URL/hash plus semantic similarity, and preserve source reliability. Apply recency decay, geospatial/entity matching confidence and independent-source corroboration before scoring.

The news ingestion uses RSS-first with Google News fallback:
1. Try RSS feed for each publisher (no API key needed)
2. If RSS fails, fall back to Google News search
3. Filter for supply-chain relevance keywords

## Math engine

The math engine (`math_engine.py`) implements:

1. **Bayesian updater**: Additive log-odds posterior with Beta uncertainty envelope
2. **Node stress**: Freshness-decayed signal intensity with bounded corroboration union
3. **Prior calculation**: Category-specific, criticality-scaled priors by horizon
4. **Kalman lead-time**: State-space forecast with p50/p80/p95 date ranges
5. **Monte Carlo exposure**: Graph propagation with BOM/inventory edges, 500 seeded trials
6. **False-alarm metrics**: Brier score, reliability bins, alert precision

All functions are standard-library only. Deterministic seed (`rng_seed`) is mandatory for reproducible demos.

## Build order

1. ✅ Math engine + unit tests
2. ✅ Source catalogue + normalizer
3. ✅ SQLite pipeline + hash dedupe
4. ✅ Live adapters (OpenMeteo, GDACS, NWS, USGS, WorldBank, GoogleNews)
5. ✅ RSS news ingestors (12 publishers)
6. ✅ Deterministic fixtures
7. ✅ FastAPI app with all routes
8. ✅ CORS configuration for frontend
