# ⚙️ SARVADARSHI — Backend Technical Specification & Engine Reference
**Document ID:** SPEC-BE-2026-V1  
**Framework:** FastAPI 0.110+ on Python 3.10 / 3.11  
**Database:** SQLite 3 (WAL mode) + In-Memory Graph Index  
**Test Suite:** Pytest (75 passed tests, 100% pass rate)

---

## 1. Directory & Codebase Layout

```
backend/
├── app.py                   # FastAPI Application Entrypoint, Route Registration, Static Mounts
├── models.py                # Pydantic v2 Schema Contracts & Validation Envelopes
├── decision_engine.py       # Core State Engine: Bayesian LLR, BOM Traversal, Monte Carlo, AI Agent
├── console.py               # Operational Decision Endpoints, SKU/Order Exposure, Mitigations
├── ingestion.py             # Sensor Pipeline: AIS, ADS-B, USGS, GDACS, Yahoo Finance Ingestion
├── run_ingestion.py         # Standalone Cron Script for Periodic Upstream Sensor Ingestion
├── math_engine.py           # Pure-Python Reference Math Implementations (LLR, Kalman, Brier)
├── demo.py                  # Deterministic Demo Scenarios & Baseline Reset Handlers
├── paqshi_seed.json         # Sanitized Canonical Ground-Truth Seed Dataset
└── tests/                   # Automated Pytest Suite (75 Tests)
    ├── test_endpoints.py    # Globe, Telemetry, and Infrastructure Route Tests
    ├── test_console_api.py  # Decision Console, SKU, and Order API Tests
    ├── test_math_engine.py  # Unit Tests for Bayesian LLR & Kalman Trajectory Filters
    ├── test_models.py       # Pydantic Schema Serialization & Validation Tests
    └── test_ingestion.py    # Sensor Fusion & Outlier Clamping Tests
```

---

## 2. Pydantic Domain Contracts (`models.py`)

All API payloads conform to deterministic Pydantic v2 models wrapped in standardized metadata envelopes:

```python
class ApiEnvelope(BaseModel, Generic[T]):
    data: T
    as_of: datetime
    model_version: str = "v1.4.0-calibrated"
    confidence: Optional[float] = 0.92
    provenance: List[str] = Field(default_factory=list)
```

### Core Schema Definitions:
- **`GlobeChokepoint`**: `id`, `name`, `category`, `latitude`, `longitude`, `stress_level`, `baseline`, `criticality`, `throughput_pct`, `confidence`.
- **`GlobeImpactEdge`**: `from_node`, `to_node`, `severity`, `latency_days`.
- **`Vessel`**: `mmsi`, `name`, `lat`, `lon`, `speed`, `heading`, `bucket` (`cargo`, `tanker`, `passenger`, `fishing`, `mil`), `is_anomaly` (bool), `anomaly_type` (str), `anomaly_desc` (str).
- **`Flight`**: `icao`, `callsign`, `lat`, `lon`, `alt_m`, `vel_ms`, `heading`, `mil` (bool), `country`, `on_ground` (bool).
- **`CustomSupplyChain`**: `id`, `name`, `priority`, `partner_3pl`, `origin` (`name`, `lat`, `lon`), `intermediate_hubs`, `destination`, `transit_days`, `sku_carried`, `status`, `stress_score`.
- **`MarketTelemetryItem`**: `symbol`, `label`, `category`, `unit`, `price`, `change`, `change_pct`, `is_up`, `source`.
- **`DecisionStressTestResult`**: `target_type`, `target_id`, `runway_hours`, `stockout_probability_pct`, `at_risk_revenue_inr`, `exposed_skus`, `mitigations_ranked`.
- **`AIQueryResponse`**: `answer`, `confidence`, `grounding_status`, `epistemic_markers`, `citations`, `recommended_actions`.

---

## 3. Comprehensive API Route Catalog

### 3.1 Globe & Sensor Telemetry Endpoints (`globe_router` in `app.py`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/globe/cascade` | Returns active chokepoints, hazard events, and impact edges. |
| `GET` | `/v1/globe/vessels` | Returns real-time AIS vessels with anomaly detection flags (loitering tankers, holding patterns). |
| `GET` | `/v1/globe/flights` | Returns live OpenSky Network ADS-B aircraft positions, velocities, and altitudes. |
| `GET` | `/v1/globe/earthquakes` | Returns GeoJSON feature collection of global seismic activity from USGS. |
| `GET` | `/v1/globe/shipping-lanes` | Returns GeoJSON LineStrings for major global container shipping routes. |
| `GET` | `/v1/globe/infra/{layer_name}` | Returns GeoJSON for infrastructure layers (`refineries`, `lng_terminals`, `data_centers`, `ports`, `airports`, `pipelines`, etc.). |
| `GET` | `/v1/globe/market/telemetry` | Returns real-time financial, freight, and commodity benchmarks via `yfinance` (`BZ=F`, `CL=F`, `BDRY`, `SMH`, `EURUSD=X`, `USDCNY=X`). |
| `GET` | `/v1/globe/supply-chains/custom` | Returns all enterprise-registered custom 3PL supply chain corridors. |
| `POST` | `/v1/globe/supply-chains/custom` | Registers a new custom supply chain corridor into the graph ontology. |
| `POST` | `/v1/ingest/live` | Triggers on-demand ingestion cycle across external upstream APIs. |

### 3.2 Decision Console & Exposure Endpoints (`console.py`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/console/summary` | Executive summary: active disruptions, exposed orders, revenue at risk, Brier score. |
| `GET` | `/v1/skus` | Lists all internal plant SKUs with on-hand inventory, daily burn rate, and runway hours. |
| `GET` | `/v1/skus/{sku_id}` | Detailed BOM breakdown, single-source dependencies, and supplier linkages for a SKU. |
| `GET` | `/v1/orders` | Lists customer purchase orders sorted by priority, value, and delivery date. |
| `GET` | `/v1/orders/{order_id}` | Returns exposed order details and contractual late penalty calculations. |
| `GET` | `/v1/suppliers` | Returns multi-dimensional supplier risk profiles (delivery, quality, financial, compliance). |
| `GET` | `/v1/signals/reliability` | Returns false alarm control metrics and Brier calibration curves. |
| `POST` | `/v1/scenarios/stress-test` | Executes Monte Carlo risk simulation for a given node failure, duration, and demand surge. |
| `GET` | `/v1/mitigations/compare` | Returns ranked mitigation playbooks comparing alternative routing, air-freight expedite, and buffer allocation. |
| `POST` | `/v1/ai/query` | Agentic operational query loop executing live graph tool-calling against LLM models. |
| `POST` | `/v1/demo/reset` | Deterministically resets graph state to canonical Singapore baseline. |

---

## 4. Decision Engine & Graph Algorithms (`decision_engine.py`)

### 4.1 Multi-Tier BOM Graph Traversal
The decision engine maintains a directed acyclic graph (DAG) representing manufacturing dependencies:
$$\mathcal{G} = (\mathcal{V}, \mathcal{E})$$
$$\mathcal{V} = \mathcal{V}_{\text{chokepoints}} \cup \mathcal{V}_{\text{suppliers}} \cup \mathcal{V}_{\text{parts}} \cup \mathcal{V}_{\text{skus}} \cup \mathcal{V}_{\text{orders}}$$
When chokepoint $c$ suffers stress $\sigma_c > 0.4$, the impact traverses all edges:
$$\text{ActiveImpact}(p) = \max_{(u, p) \in \mathcal{E}} \left( \sigma_u \times w_{up} \right)$$
Parts with active impact propagate risk to their parent SKUs:
$$\text{Risk}_{\text{SKU}} = 1 - \prod_{p \in \text{Parts}(\text{SKU})} \left(1 - \text{ActiveImpact}(p) \times \text{Criticality}(p) \right)$$

### 4.2 Monte Carlo Stress Simulator
The endpoint `/v1/scenarios/stress-test` executes $N = 1,000$ iterations:
1. Samples demand $D_t \sim \mathcal{N}(\mu_d, \sigma_d^2)$ across the scenario duration.
2. Models replenishment delay $L \sim \text{LogNormal}(\mu_L, \sigma_L^2)$ conditioned on chokepoint stress.
3. Tracks daily on-hand inventory $I_{t} = I_{t-1} - D_t$.
4. Computes exact stockout hour $H_{\text{stockout}} = \min \{ t : I_t \le 0 \} \times 24$.

### 4.3 Grounded AI Agent Tool Loop
The `/v1/ai/query` endpoint executes a multi-turn agentic loop:
1. **Context Extraction:** Assembles active disruptions, high-risk suppliers, vulnerable SKUs, and spot commodity prices.
2. **LLM Invocation:** Calls Google Gemini API (`gemini-2.5-flash` via `google-genai` SDK) or OpenRouter/OpenAI endpoints with system instructions mandating strict grounding.
3. **Deterministic Fallback:** If upstream API keys are absent or rate-limited, the engine falls back to an offline rule-based Bayesian expert system, guaranteeing zero demo crashes.

---

## 5. Database Schema (SQLite 3)

The backend persists raw events and canonical ontology structures in SQLite:

```sql
-- Events Ledger
CREATE TABLE events (
    id                  TEXT PRIMARY KEY,
    actor               TEXT,
    action              TEXT NOT NULL,
    object              TEXT,
    location            TEXT,
    latitude            REAL,
    longitude           REAL,
    occurred_at         TEXT,
    confidence          REAL,
    corroboration_score INTEGER,
    contradiction_flag  INTEGER,
    domain              TEXT,
    event_category      TEXT,
    raw_text            TEXT
);

-- Strategic Chokepoints
CREATE TABLE chokepoints (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    category            TEXT NOT NULL,
    latitude            REAL NOT NULL,
    longitude           REAL NOT NULL,
    stress_level        REAL DEFAULT 0.0,
    baseline_traffic    REAL DEFAULT 100.0,
    criticality         REAL DEFAULT 0.5
);

-- Inter-Node Impact Relations
CREATE TABLE cp_relations (
    from_node           TEXT NOT NULL,
    to_node             TEXT NOT NULL,
    severity            REAL NOT NULL,
    latency_days        REAL NOT NULL,
    PRIMARY KEY (from_node, to_node)
);
```

---

## 6. Verification & Automated Testing

The backend is validated by 75 automated unit and integration tests:
```bash
pytest backend/tests/ -q
# Result: 75 passed, 1 skipped, 1 warning (10.19s)
```
- **Test Coverage:** Model validation, API response envelope conformances, Bayesian LLR computation correctness, Kalman filter boundary conditions, and mock fallback execution.
