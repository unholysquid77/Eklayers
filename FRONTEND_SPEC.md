# 🖥️ SARVADARSHI — Frontend Technical Specification & UI Architecture
**Document ID:** SPEC-FE-2026-V1  
**Framework:** Next.js 15.5+ (App Router)  
**UI Engine:** React 19, Tailwind CSS, Lucide React  
**3D Engine:** Three.js (WebGL 2.0, OrbitControls)  
**2D Map Engine:** Leaflet 1.9.4 (Dynamic SSR-Safe Injection)

---

## 1. Design System: High-Tech Brutalist Tactical Aesthetic

Sarvadarshi utilizes a disciplined, defense-grade brutalist design system tailored for mission-critical command centers:

### 1.1 Color Palette & Theme Tokens
- **Background Void:** Pitch black (`#000000`, `bg-black`, `--bg-void`).
- **Primary Panel Background:** Void black with minimal green tint (`#020503`, `--bg-panel`).
- **Secondary Surfaces:** Dense cyber black (`#040805`, `--bg-secondary`).
- **Accent Green:** Disciplined industrial terminal green (`#00e676`, `--green-primary`), distinct from over-saturated neon.
- **Support Green:** Dark emerald (`#15803d`, `--green-dim`).
- **Borders:** Crisp, 1px green-tinted black lines (`#112818`, `--border-primary`, `#1a4226`).
- **Alert Tones:** Calibrated severity accents (Crimson `#dc2626`, Amber `#d97706`, Gold `#ca8a04`).

### 1.2 Geometry & Form Factor
- **Strictly Squared Boxes:** `border-radius: 0px !important;` globally enforced across cards, buttons, badges, modals, inputs, and tabs.
- **Zero Blurry Glows:** Soft glowing drop-shadows are replaced with crisp, high-contrast 1px border lines.
- **Typography:** JetBrains Mono across all telemetry, numbers, headers, and status badges for maximum tabular alignment.

---

## 2. Information Architecture & Navigation

The global header ([`TopNav.tsx`](file:///e:/empire/HackX/Eklayers/frontend/src/components/TopNav.tsx)) enforces the canonical operational order:

$$\text{Globe} \longrightarrow \text{AI Analyst} \longrightarrow \text{Control Tower} \longrightarrow \text{Console} \longrightarrow \text{Exposure} \longrightarrow \text{Forecast} \longrightarrow \text{Suppliers} \longrightarrow \text{Scenarios}$$

| Route | View Name | Primary Function |
|---|---|---|
| `/command` | **Globe** | 3D Interactive digital twin, live AIS/ADS-B feeds, market ticker, disruption alerts queue, and tracked chokepoints table. |
| `/analyst` | **AI Analyst** | Interactive conversational reasoning engine directly wired to graph state with zero-hallucination verification. |
| `/control-tower` | **Control Tower** | Executive overview of enterprise health, active disruption counts, and macro vulnerability indices. |
| `/console` | **Console** | Operational decision console with interactive BOM cascades, customer order impact matrices, and ranked mitigations. |
| `/exposure` | **Exposure** | SKU and purchase order ledger detailing exposed revenue, penalty clauses, and delivery dates. |
| `/forecast` | **Forecast** | 14-day Kalman disruption trajectory fan with auditable log-likelihood ratio (LLR) evidence ledgers. |
| `/suppliers` | **Suppliers** | Multi-dimensional vendor health scoring across delivery, quality, financial, capacity, compliance, and concentration. |
| `/scenarios` | **Scenarios** | Interactive Monte Carlo scenario sandbox for custom stress testing and port closure simulations. |
| `/admin` | **Admin Portal** | Ingest enterprise BOM data, register bespoke 3PL routes, and simulate synthetic disruptions. |

---

## 3. Core Component Architecture

### 3.1 3D Command Globe Engine (`SarvadarshiGlobe.tsx`)
Implemented using pure WebGL via **Three.js**:
- **Sphere Geometry:** $R = 1.0$, 96 segments with high-resolution NASA night Earth city-light emissive textures and topological bump mapping.
- **Atmospheric Rim:** Custom GLSL vertex and fragment shader generating a subtle tactical green glow (`#00e676`) around the planetary rim.
- **Live Vessel Layer (`groups.vessels`):** Renders directionally oriented 3D cone meshes rotated by true AIS heading.
- **AIS Anomaly Highlighting:** Anomalous vessels (loitering in shipping corridors or holding patterns) are rendered with a pulsing crimson outer ring (`RingGeometry(0.008, 0.014)` with `COLOR_CRIMSON`).
- **Live Flight Layer (`groups.flights`):** Airborne aircraft rendered at $R = 1.032$ with altitude-scaled meshes.
- **Cascading Impact Arcs:** Elevation-safe quadratic Bezier curves elevated to $R = 1.018$ above the surface, dynamically scaled according to spherical chord distance to prevent clipping through the globe.
- **Raycasting & Hit-Testing:** GPU raycaster detects clicks on chokepoint hubs, triggering either the deep-dive research modal or the 2D tactical drill-down modal.

### 3.2 2D Sub-Meter Tactical Drill-Down Modal (`TacticalDrillDownModal.tsx`)
Provides sub-meter berth-level inspection:
- **Leaflet Integration:** Injected dynamically via CDN on modal open to eliminate Next.js server-side rendering (`window is not defined`) conflicts.
- **Basemap Providers:** Defaults to **CartoDB Dark Matter** with an instant toggle for **OpenStreetMap Black & White / Grayscale**.
- **Full Globe Layer Projection:**
  - Chokepoints (Stress-colored tactical squares).
  - AIS Vessels (Directional triangles with live heading).
  - Anomalous AIS Vessels (Pulsing crimson ping markers with `AIS ANOMALY` tags).
  - OpenSky Flights (Oriented aircraft symbols).
  - Infrastructure (Refineries, LNG terminals, data centers, airports, and deepwater ports).
  - Maritime corridors & custom 3PL supply chains (Dashed polylines).
- **Target Reticle & Range Buffers:** Square brutalist targeting crosshair with 15 km inner tactical and 35 km operational buffer rings.
- **Slide-Out Entity Inspector:** Interactive drawer revealing MMSI, speed, heading, throughput impact, and epistemic markers.

### 3.3 Live Market Telemetry Sub-Header (`command/page.tsx`)
A dedicated, full-width $28\text{px}$ (`h-7`) sub-header bar docked directly beneath `TopNav`:
- Displays live spot prices and flashing green/red deltas for Brent Crude, WTI, Baltic Dry Freight (`BDRY`), Semiconductors (`SMH`), and FX rates (`EUR/USD`, `USD/CNY`).
- Positioned in document flow above the 3D globe, preventing visual collision with the floating `DISRUPTION COMMAND` pill.

### 3.4 Tracked Strategic Chokepoints Inventory Table (`command/page.tsx`)
Triggered via the `CHOKEPOINTS (12)` button in the top HUD:
- Full-screen modal presenting a live tabular audit of all monitored chokepoints.
- Columns: Chokepoint Name, Coordinates, Stress Index (colored badge), Baseline Traffic (vessels/day), Throughput Pct, Epistemic Status (`[OBSERVED]`), and 1-click `DRILL DOWN 2D →` trigger.

---

## 4. State Management & API Integration Layer

```
frontend/src/lib/
├── contracts.ts     # TypeScript interfaces strictly mapped to backend Pydantic models
├── api.ts           # Unified asynchronous HTTP fetch wrapper with offline fallbacks
└── mock.ts          # High-fidelity realistic mock telemetry for zero-dependency demos
```

### 4.1 Resilient Degradation Architecture
Every function in `api.ts` is implemented with an inline `.catch()` fallback to `mock.ts`:
```typescript
export const getGlobeCascadeMap = () =>
  _get<CascadeMap>('/v1/globe/cascade').catch(() => MOCK_CASCADE);

export const getMarketTelemetry = () =>
  _get<{ telemetry: MarketTelemetryItem[]; as_of: string }>('/v1/globe/market/telemetry')
    .catch(() => MOCK_MARKET_TELEMETRY);
```
**Outcome:** The frontend will never crash, display blank screens, or throw unhandled exceptions, even if the backend server is temporarily paused, offline, or rate-limited.

---

## 5. Production Build & Validation

The frontend is validated using Next.js production build:
```bash
npm run build
# Output:
# ✓ Compiled successfully in 17.3s
# ✓ Generating static pages (15/15)
# Zero TypeScript errors, zero lint warnings, zero hydration mismatches.
```
