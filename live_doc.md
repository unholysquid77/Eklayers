# Sarvadarshi — Live Change Log

This document tracks every change made to the codebase so teammates can follow along. Updated as changes land.

---

## 2026-09-11 — Globe Rebuild + Frontend Cleanup (Session 2)

### New: `SarvadarshiGlobe.tsx`

Three.js globe component ported from `Paqshi_references/brain_mode.html` (user's own code):

- Earth sphere with NASA night texture + bump map
- Atmosphere halo shader (blue glow)
- Starfield (1200 stars)
- Latitude rings (equator, tropics, polar circles)
- Country borders (Natural Earth 110m GeoJSON, fetched once)
- Port/signal pins with stress-level colors (green/yellow/red)
- Pulsing halos on high-intensity pins
- Event dots colored by signal type
- Cascade arcs between features (quadratic Bezier curves)
- Click-to-inspect via raycaster
- Auto-rotation with damped camera

Replaced `OsirisMap.tsx` (3,268-line Paqshi OSINT component with CCTV, aircraft, satellite tracking).

### Updated: `/command` page

- Now uses `SarvadarshiGlobe` instead of `OsirisMap`
- Globe receives alert data as GeoJSON features
- Click on globe pin opens corresponding alert detail
- Fixed branding: "SUPPLYCHAIN SENTINEL" → "SARVADARSHI"

### Removed: Paqshi bloat

**36 components deleted:**
AiOverview, ArcGISPanel, CameraViewer, CctvPreviews, ChainBrief, DirectionsBar, DrawHud, DrawingToolbar, FlightWatchPanel, GlobalStatusBar, IntelFeed, KeyboardShortcuts, LayerPanel, LiveAlerts, LiveNewsPreviews, MapControls, MarketChart, MarketsPanel, NavigationView, OsintPanel, OsirisMap, SatelliteCard, ScaleBar, ScmPanel, SearchBar, SharePanel, SpaceCam, StyleStudio, TokenPanel, ViewPresets, WorldRemote + test files

**~90 API routes deleted:** CCTV, satellites, flights, aircraft, markets, directions, malware, ArcGIS, etc.

**~50 lib files deleted:** camera-feed, malware-intel, satellite-layer, navigation, orbit, skyline, etc.

**Deleted:** `middleware.ts` (Paqshi Umami analytics), `instrumentation.ts`, `docs/` page, `scratch/` directory, `lib/sdk/`

### Added: `three` dependency

Added `three@^0.160.0` and `@types/three@^0.160.0` to `package.json`.

### What remains in frontend

```
src/
  app/
    command/page.tsx    — Globe + alerts
    risk/page.tsx       — Supplier dashboard
    layout.tsx          — Root layout (Sarvadarshi branded)
    page.tsx            — Redirect to /command
    globals.css         — Design system
  components/
    ErrorBoundary.tsx   — Error boundary
    SarvadarshiGlobe.tsx — Three.js globe
  lib/
    api.ts              — Typed API client
    contracts.ts        — TypeScript interfaces
```

---

## 2026-09-11 — Globe Rebuild + API Routes Restored (Session 2b)

### What changed

The user wanted `brain_mode.html` as the actual globe page (not a React component), with all its original features preserved, plus the deleted Paqshi API routes restored to feed data into it.

### New files

| File | Purpose |
|---|---|
| `frontend/public/brain_mode.html` | Copied from `Paqshi_references/brain_mode.html` — the actual Three.js globe with all features (aircraft, vessels, borders, events, arcs, chokepoints, time scrub, tactical map, etc.) |
| `frontend/src/app/ui/[[...slug]]/route.ts` | Catch-all proxy for `/ui/*` routes that brain_mode.html fetches from. Tries Paqshi backend first (`PAQSHI_BACKEND_URL` env), falls back to mock data |
| `frontend/src/components/SarvadarshiGlobe.tsx` | Three.js globe React component (for `/command` page) |

### How it works

1. `GET /` redirects to `/brain_mode.html` (served from `public/`)
2. brain_mode.html loads Three.js from CDN import map
3. On boot, it fetches `/ui/cascade/map` → proxy route → Paqshi backend or mock data
4. Globe renders chokepoints (stress-colored pins), events (domain-colored dots), impact arcs
5. Layer toggles fetch `/ui/flights`, `/ui/vessels` → proxy route → external APIs or mock data
6. Click on chokepoint fetches `/ui/chokepoints/{id}` → drill-down panel
7. Brief ticker fetches `/ui/brief/latest` → bottom ticker bar

### Mock data (when Paqshi backend is offline)

The proxy route returns deterministic mock data for all `/ui/*` endpoints:
- 10 chokepoints (Suez, Hormuz, Malacca, Panama, Singapore, Shanghai, Rotterdam, LA, Cape, Bab el-Mandeb)
- 8 events (geopolitics, corporate, climate, technology)
- 7 impact edges
- 6 flights (civil + military)
- 6 vessels (cargo, tanker, passenger, fishing, military)
- All detail endpoints (chokepoint history, events, alerts, brief, tracks, country, cluster)

### What's preserved from brain_mode.html

Everything:
- Three.js globe with NASA textures, atmosphere shader, starfield, latitude rings
- Country borders (Natural Earth 110m)
- Chokepoint pins with stress colors + pulsing halos
- Event dots by domain (geopolitics/corporate/climate/technology)
- Cascade arcs (quadratic Bezier)
- Aircraft layer (InstancedMesh, civil + military)
- Vessel layer (InstancedMesh, by bucket type)
- Vessel tracks (great-circle arcs)
- Time scrubber
- 2D tactical MapLibre drill-down overlay
- Layer controls
- Brief ticker
- Country drill-down
- FPV follow mode
- Click-to-inspect raycaster

### Restored Paqshi API routes

All ~90 Next.js API routes restored from git history (under `frontend/src/app/api/`). These are available if someone runs the Paqshi backend and points `PAQSHI_BACKEND_URL` at it.

### Remaining branding fixes needed

The restored Paqshi components/files still contain "OSIRIS" and "Paqshi" references. These can be cleaned up in a follow-up pass. The critical user-facing text (brain_mode.html title, layout metadata) still says "Paqshi" — this should be updated.

### Pending

1. Run `npm install` to install `three` dependency
2. Test: start Next.js dev server, visit `http://localhost:3000`, globe should render
3. Optional: set `PAQSHI_BACKEND_URL` for real data instead of mocks
4. Clean up remaining OSIRIS/Paqshi branding in restored files

---

## 2026-09-11 — Initial Build (Session 1)

### Backend

#### `backend/math_engine.py` (pre-existing)
Standard-library-only math engine with:
- `bayesian_update()` — additive log-odds posterior with Beta envelope
- `node_stress()` — freshness-decayed signal intensity
- `prior_for_node()` — category-specific priors by horizon
- `KalmanLeadTime` — state-space lead-time forecast
- `monte_carlo_exposure()` — graph propagation with BOM/inventory edges
- `false_alarm_metrics()` — Brier score, alert precision, source penalties

#### `backend/sources.py` (pre-existing)
Live adapters: OpenMeteo, GDACS, NWS, USGS, WorldBank, GoogleNews. User-agent: `Sarvadarshi/0.1`.

#### `backend/ingestion.py` (pre-existing)
Source catalogue (`SOURCES` tuple) + `normalize_signal()`.

#### `backend/pipeline.py` (pre-existing)
`IngestionPipeline`, `SignalStore` (SQLite), `RunSummary`. Default DB: `data/sarvadarshi.db`.

#### `backend/fixtures.py` (NEW)
Deterministic seed data:
- 11 signals: 3 weather (Tropical Storm Bolaven, USGS earthquake, GDACS Philippines typhoon), 3 logistics (Singapore port congestion, Suez route alert, Belgium labour strike), 5 supply-chain news (semiconductor shortage, tariff escalation, customs delays, East Coast port strike, rare earth disruption)
- 10 monitored locations: Singapore, Shanghai, Rotterdam, Los Angeles, Hamburg, Busan, Dubai, Antwerp, Felixstowe, Hong Kong
- 15 operational nodes: 5 suppliers, 6 parts, 3 SKUs, 1 customer
- 14 dependency edges: supply, assembly, manufacturing, logistics relationships

Key functions: `seed_demo_data()` seeds all data into SQLite, returns summary dict.

#### `backend/news_ingestors.py` (NEW)
12 supply-chain publishers with RSS-first + Google News fallback:

| Publisher | RSS Feed |
|---|---|
| FreightWaves | freightwaves.com/.../rss.xml |
| Loadstar | theloadstar.com/feed |
| Splash247 | splash247.com/feed |
| gCaptain | gcaptain.com/feed |
| JOC | joc.com/rss |
| SupplyChainDive | supplychaindive.com/feeds/news |
| Lloyd's List | lloydslist.com/.../rss |
| ContainerNews | containernews.com/rss |
| Maritime Executive | maritime-executive.com/feed |
| Hellenic Shipping | hellenicshippingnews.com/feed |
| Drewry | drewry.co.uk/news/rss |
| SupplyChainBrain | supplychainbrain.com/rss |

Google News query: `"supply chain disruption" OR "port congestion" OR "shipping delay"`

#### `backend/app.py` (NEW)
FastAPI app with 21 routes:

**Alerts & disruption:**
- `GET /v1/alerts` — ranked alert queue with posteriors, evidence ledger
- `GET /v1/alerts/{id}` — single alert detail
- `GET /v1/exposure?alert_id=` — exposure graph/table
- `GET /v1/chokepoints/{id}/forecast` — chokepoint forecast

**Suppliers & risk:**
- `GET /v1/suppliers` — all suppliers with risk scores
- `GET /v1/suppliers/{id}/risk` — detailed supplier risk (0-100), dimensions, factor ledger
- `GET /v1/concentration` — concentration risk analysis

**Stress tests:**
- `POST /v1/stress-tests` — Monte Carlo cascade (500 trials, deterministic seed)

**Map:**
- `GET /v1/map/layers` — GeoJSON layers for globe (ports, hazard zones, routes)

**Ingestion:**
- `POST /v1/ingest/signals` — ingest risk signals
- `POST /v1/ingest/operational` — ingest operational data
- `POST /v1/ingest/live` — trigger live fetch from all sources

**Demo:**
- `POST /v1/demo/reset` — reset to fixture data
- `POST /v1/demo/seed` — seed fresh fixture data

**Health:**
- `GET /health` — health check

CORS: allows `http://localhost:3000` and `http://localhost:3001`.

Envelope format: `{ data, as_of, model_version, provenance }`.

#### `backend/demo.py` (pre-existing)
Offline deterministic demo.

#### `backend/run_ingestion.py` (pre-existing)
CLI entry point. Default DB: `data/sarvadarshi.db`.

#### `backend/tests/test_math_engine.py` (pre-existing)
7 math engine tests — all passing.

---

### Frontend

#### `frontend/src/app/page.tsx` (NEW)
Simple redirect to `/command` using Next.js `redirect()`.

#### `frontend/src/app/layout.tsx` (REWRITTEN)
- Title: "Sarvadarshi — Disruption Intelligence"
- Metadata: OpenGraph, Twitter card, viewport, dark theme
- ErrorBoundary wrapping children
- No more Paqshi branding

#### `frontend/src/app/globals.css` (REBRANDED)
- Comment: "Sarvadarshi — Design System"
- Theme variables: "Sarvadarshi theme — muted blue on black"
- Animation classes renamed: `.sarvadarshi-glow`, `.sarvadarshi-pulse`, `.sarvadarshi-scan`, `.sarvadarshi-rotate`
- All original design tokens preserved (glassmorphism, severity, status, gauge classes)

#### `frontend/src/app/command/page.tsx` (NEW)
Globe + disruption alerts page:
- OsirisMap globe with `dark-matter` basemap
- Alert sidebar: ranked alert cards with severity color, type icon, posterior, confidence
- Alert detail popup: evidence factors, log-likelihood contributions, affected nodes
- Zulu clock (HH:MM:SSZ format)
- "Load Live Data" button → `POST /v1/ingest/live`
- "Reset Demo" button → `POST /v1/demo/reset`
- "Risk Dashboard" link → `/risk`

#### `frontend/src/app/risk/page.tsx` (NEW)
Supplier risk dashboard page:
- Supplier list with risk scores (0-100)
- Risk score card with gauge visualization
- Dimension bars (delivery, quality, financial, capacity, compliance)
- Factor ledger table (source, name, log-likelihood, weight, contribution)
- Cascade exposure table (upstream nodes, probability, impact, stock-out days)
- Stress test buttons: Port Disruption (Singapore), Supplier Failure (acme-electronics), Route Closure (Suez Canal)
- Concentration risk panel
- Summary stats: total suppliers, avg risk, high risk count, concentration, affected nodes
- "Command Center" link → `/command`

#### `frontend/src/lib/api.ts` (NEW)
Typed API client:
- `getAlerts()`, `getAlert(id)`, `getExposure(alertId)`
- `getSuppliers()`, `getSupplierRisk(id)`, `getConcentration()`
- `runStressTest(body)`, `getMapLayers()`
- `ingestSignals(body)`, `ingestOperational(body)`, `ingestLive()`
- `resetDemo()`, `seedDemo()`, `getHealth()`

Base URL: `http://localhost:8000` (configurable via `API_BASE`).

#### `frontend/src/lib/contracts.ts` (NEW)
TypeScript interfaces:
- `ApiEnvelope<T>`, `Alert`, `AlertEvidence`, `ExposureRow`
- `Supplier`, `SupplierRiskScore`, `SupplierDimension`
- `StressTestRequest`, `StressTestResult`, `StressTestNode`
- `ConcentrationInfo`, `MapLayer`, `DemoLocation`, `DemoNode`, `DemoDependency`
- `IngestSignalsRequest`, `IngestOperationalRequest`, `IngestLiveResponse`
- `DemoSeedResponse`, `HealthResponse`

#### `frontend/src/components/OsirisMap.tsx` (pre-existing)
MapLibre GL globe component retained from Paqshi.

#### `frontend/package.json` (REBRANDED)
- Name: `sarvadarshi` (was `supplychain-sentinel`, then `osiris`)

---

### Docs

#### `docs/PRODUCT_SPEC.md` (UPDATED)
- Rebranded to Sarvadarshi
- Updated to reflect actual implemented architecture
- Added fixture data tables (signals, locations, nodes, dependencies)
- Added "Key architectural decisions" section

#### `docs/BACKEND_SPEC.md` (UPDATED)
- Added "Implemented files" table
- Added full API surface table (21 routes)
- Updated Paqshi sources table
- Added "Build order" checklist (all items complete)
- Updated news ingestion approach (RSS-first + Google News fallback)

#### `docs/FRONTEND_SPEC.md` (UPDATED)
- Added "Implemented files" table
- Added component plan for both pages
- Added "Design system" section documenting CSS classes
- Removed Tanstack Query, Zod, Recharts references

#### `docs/IO_CONTRACT.md` (UPDATED)
- Added complete fixture data documentation
- Added signal table (11 signals with coordinates, intensity)
- Added location table (10 ports with coordinates, congestion, hazard)
- Added operational nodes table (15 nodes with risk profiles)
- Added dependency edges table (14 edges with probabilities)
- Added math engine function signatures and formulas

#### `README.md` (REBRANDED)
- Title: "Sarvadarshi"

---

## Test Results

```
$ python -m pytest backend/tests -q
.......                                                                                   [100%]
7 passed in 0.17s
```

## How to Run

### Backend
```bash
cd E:\empire\Hackx
python -m uvicorn backend.app:app --reload --port 8000
```

### Frontend
```bash
cd E:\empire\Hackx\frontend
npm ci
npm run dev
```

### Seed Demo Data
```bash
curl -X POST http://localhost:8000/v1/demo/seed
```

### Run Live Ingestion
```bash
curl -X POST http://localhost:8000/v1/ingest/live
```

---

## Pending / Next Steps

1. **Frontend build verification** — `npm ci` timed out (network issues). Run manually to verify TypeScript compiles.
2. **End-to-end testing** — Start both servers, verify globe renders, alerts load, supplier risk works.
3. **Trim unused Paqshi components** — Remove IntelFeed, MarketsPanel, ScmPanel, SearchBar, etc. from `src/components/`.
4. **Polish UI** — Add loading skeletons, empty states, error boundaries to both pages.
5. **Fix OsirisMap imports** — `@/services/panoramaService` and `@/services/overflightService` are missing. Either stub them or create minimal implementations.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Sarvadarshi                           │
├──────────────────┬──────────────────────────────────────┤
│   Frontend       │   Backend                            │
│   (Next.js 16)  │   (FastAPI + SQLite)                 │
├──────────────────┼──────────────────────────────────────┤
│ /command         │   GET  /v1/alerts                    │
│  - Globe         │   GET  /v1/exposure                  │
│  - Alert sidebar │   POST /v1/stress-tests              │
│                  │   POST /v1/ingest/live               │
│ /risk            │   POST /v1/demo/seed                 │
│  - Suppliers     │                                      │
│  - Risk scores   │   math_engine.py                     │
│  - Cascade table │    - Bayesian updater                │
│  - Stress tests  │    - Kalman lead-time                │
│                  │    - Monte Carlo exposure             │
│ api.ts           │    - False-alarm metrics             │
│ contracts.ts     │                                      │
│                  │   fixtures.py                        │
│ OsirisMap.tsx    │    - 11 signals                      │
│ (MapLibre GL)    │    - 10 locations                    │
│                  │    - 15 nodes                        │
│                  │    - 14 dependencies                 │
└──────────────────┴──────────────────────────────────────┘
```
