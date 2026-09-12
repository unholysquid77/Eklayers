# 🌐 SARVADARSHI (सर्वदर्शी)
### Autonomous Global Supply Chain Disruption Prediction & Epistemic Decision Command System

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-2D_Tactical-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Pytest](https://img.shields.io/badge/Tests-75%20Passed-00ff88?style=for-the-badge&logo=pytest&logoColor=black)](https://docs.pytest.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

> **"Can a supply-chain planner immediately understand what is going wrong, what will be affected, when it will hurt, and what action will reduce the damage?"**

**Sarvadarshi** is a defense-grade supply-chain disruption command center. It bridges real-time geopolitical & sensor telemetry (marine AIS transponders, ADS-B aircraft, USGS seismic activity, weather alerts) with rigorous **Bayesian Log-Likelihood Ratio (LLR)** inference, **Kalman 14-day trajectory forecasting**, and **multi-tier BOM graph propagation** to trace risks directly from physical chokepoints down to plant floor SKUs and customer revenue.

---

## 📸 Key Features & Architecture

```
                                  LIVE SENSOR FEEDS & OSINT
            [AIS Vessels]  [OpenSky Aircraft]  [USGS Earthquakes]  [Yahoo Finance]
                                       │
                                       ▼
                       ┌────────────────────────────────┐
                       │   INGESTION & SENSOR FUSION    │
                       │   Outlier Clamping & Normalizer│
                       └───────────────┬────────────────┘
                                       │
                                       ▼
                       ┌────────────────────────────────┐
                       │  EPISTEMIC BAYESIAN INFERENCE  │
                       │  • Log-Likelihood Ratio (LLR)  │
                       │  • Kalman Filter 14-Day Traj   │
                       │  • Monte Carlo Risk Diffusion  │
                       └───────────────┬────────────────┘
                                       │
                                       ▼
                       ┌────────────────────────────────┐
                       │    GRAPH ONTOLOGY & BOM ENGINE │
                       │ Chokepoints ➔ Suppliers ➔ SKUs │
                       └───────────────┬────────────────┘
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 ▼                                           ▼
┌────────────────────────────────┐          ┌────────────────────────────────┐
│   3D TACTICAL COMMAND GLOBE    │          │  2D SUB-METER DRILL-DOWN MAP   │
│  • Three.js Night Vector Earth │          │  • Carto Dark & OSM Grayscale  │
│  • AIS Anomalies (Loitering)   │          │  • Sub-Meter Berth Inspection  │
│  • Global Maritime Corridors   │          │  • Tactical Buffer Rings       │
│  • Live Commodity Telemetry    │          │  • Full Multi-Layer Overlay    │
└────────────────────────────────┘          └────────────────────────────────┘
```

---

## ⚡ Core Capabilities

### 1. 3D Planetary Digital Twin & Real-Time Sensor Fusion
- **Three.js WebGL Earth Model**: Custom high-resolution night Earth topology with tactical atmospheric glow and real-time lighting.
- **Live Maritime AIS Telemetry**: Real-time position, speed, class, and heading for global commercial vessels.
- **Pulsing AIS Anomaly Detection**: Automated real-time identification of loitering tankers in primary shipping lanes (Malacca TSS) and abnormal holding patterns (Strait of Hormuz) flagged with crimson rings.
- **OpenSky Network ADS-B Stream**: High-altitude commercial and military cargo flights rendered with true heading orientation.
- **Critical Infrastructure Overlays**: Refineries, LNG terminals, hyperscale data centers, undersea fiber cables, pipelines, and commercial deepwater ports.

### 2. 2D Tactical Sub-Meter Drill-Down (`TacticalDrillDownModal`)
- Seamless transition from 3D macro-globe to high-contrast **CartoDB Dark Matter** or **OpenStreetMap Grayscale** tactical basemap.
- Complete layer projection: Chokepoints, AIS vessels, aircraft, pipelines, and shipping lanes.
- Range buffers: 15 km inner tactical buffer and 35 km operational buffer rings.
- **Entity Inspector**: One-click slide-out HUD displaying exact GPS telemetry, vessel MMSI, true speed, ICAO codes, and throughput impact.

### 3. Epistemic Bayesian Reasoning & Disruption Engine
- **Zero Hallucination / Grounded Probabilities**: Every alert is tagged with auditable epistemic markers (`[OBSERVED]`, `[INFERRED]`, `[PREDICTED]`, `[SIMULATED]`).
- **Bayesian LLR Updates**: Evidence from weather anomalies, naval activity, labor strikes, and transponder loss update node stress levels in real time.
- **14-Day Kalman Trajectory Fan**: Generates probabilistic $P_{50}, P_{80}, P_{95}$ delay curves.
- **False Alarm Control**: Continuous Brier score calibration to prevent alert fatigue.

### 4. Multi-Tier BOM & Revenue-at-Risk Engine
- Traces physical maritime disruptions (e.g. Malacca, Suez, Hormuz, Bab el-Mandeb) through Tier-1 and Tier-2 suppliers directly to manufacturing plants (e.g. Pune Gigafactory, Singapore Hub).
- Calculates SKU daily burn rate, on-hand safety buffer, stockout runway hours, and exposed customer orders.

### 5. Live Market Telemetry & Custom 3PL Corridors
- **Yahoo Finance Telemetry**: Live prices and percent changes for global supply chain benchmarks:
  - Brent Crude (`BZ=F`) & WTI Crude (`CL=F`)
  - Baltic Dry Marine Freight Index (`BDRY`)
  - Semiconductor Index (`SMH`)
  - Natural Gas (`NG=F`)
  - FX Rates: EUR/USD (`EURUSD=X`), USD/CNY (`USDCNY=X`)
- **Enterprise 3PL Route Builder**: Operators can register custom supply chain corridors with specific carriers (Maersk, DHL, Kuehne+Nagel, FedEx) in the `/admin` portal, dynamically rendering them across both the 3D globe and 2D tactical maps.

### 6. Autonomous AI Intelligence Analyst
- Interactive natural language intelligence console wired directly to live ontology graph state.
- Supports **Google Gemini API** (`gemini-2.5-flash`) and **OpenRouter/OpenAI** models with automated grounded reasoning fallback.
- **"Regenerate Intelligence Synthesis"** triggers multi-source graph synthesis across active disruptions, BOM exposures, and market trends.

---

## 🗺️ Application Route Matrix

| Route | View | Description |
|---|---|---|
| `/command` | **Disruption Command Center** | 3D Interactive Globe, live AIS/ADS-B feeds, market ticker, disruption alerts, and tracked chokepoints inventory table. |
| `/console` | **Operational Decision Console** | Executive KPI cards, multi-tier BOM cascades, revenue-at-risk charts, and ranked mitigation playbooks. |
| `/risk` | **Risk Matrix & Matrix View** | Multi-dimensional supplier vulnerability scoring, single-source dependencies, and regional exposure. |
| `/exposure` | **Order & SKU Exposure** | Detailed breakdown of exposed customer purchase orders, penalty clauses, and delivery dates. |
| `/scenarios` | **Monte Carlo Scenario Sandbox** | Interactive stress-testing simulator; model port closures, lead-time shocks, and demand surges. |
| `/forecast` | **14-Day Trajectory Fan** | Kalman filter disruption curves with auditable log-likelihood ratio (LLR) evidence ledgers. |
| `/suppliers` | **Supplier Intelligence Profiles** | Tier-1 and Tier-2 vendor financial health, lead-time variance, and geographic clustering. |
| `/analyst` | **AI Operational Analyst** | Natural language reasoning engine backed by live graph queries and zero-hallucination verification. |
| `/admin` | **Enterprise Admin Portal** | Ingest enterprise BOM data, register bespoke 3PL routes, and simulate synthetic disruptions. |

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: `v18+` (v20 or v24 recommended)
- **Python**: `3.10+` (3.11 recommended)
- **Package Managers**: `npm` and `pip`

### 1. Clone the Repository
```bash
git clone https://github.com/unholysquid77/Eklayers.git
cd Eklayers
```

### 2. Backend Setup
```bash
# Optional: Create and activate a virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run backend test suite (75 tests)
pytest backend/tests/ -q

# Start the FastAPI server
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```
*Backend runs on `http://localhost:8000` (Swagger docs available at `http://localhost:8000/docs`).*

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Build production bundle (verifies TypeScript & route compilation)
npm run build

# Start Next.js development server
npm run dev
```
*Frontend opens at `http://localhost:3000`.*

---

## 🧮 Mathematical Reference

### 1. Bayesian Log-Likelihood Ratio (LLR) Update
$$L_{t} = L_{t-1} + \sum_{i} \text{LLR}_i$$
$$P(\text{Disruption} \mid \mathbf{E}) = \frac{1}{1 + e^{-L_t}}$$
where each evidence item $E_i$ updates the log-odds based on its observed signal strength:
$$\text{LLR}_i = \ln \frac{P(E_i \mid \text{Disruption})}{P(E_i \mid \neg\text{Disruption})}$$

### 2. Kalman Filter Disruption Trajectory
$$\hat{x}_{k|k} = \hat{x}_{k|k-1} + K_k (y_k - H_k \hat{x}_{k|k-1})$$
$$P_{k|k} = (I - K_k H_k) P_{k|k-1}$$

### 3. Monte Carlo Lead-Time Tail Risk
$$P(\text{Stockout}) = \frac{1}{N} \sum_{j=1}^{N} \mathbb{I}\left( \sum_{t=1}^{D_j} \text{Demand}_t > \text{Inventory}_{\text{on-hand}} \right)$$

---

## 🛡️ License & Acknowledgements

Developed for **HackX 2026** — Supply Chain Disruption Prediction (PS #3) and Continuous Supplier Risk Scoring (PS #9).

Distributed under the **MIT License**.
