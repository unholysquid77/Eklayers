# 🌐 SARVADARSHI (सर्वदर्शी) — System Architecture & Operational Specification
**Document ID:** SPEC-SYS-2026-V1  
**Status:** Production / Master Reference  
**Scope:** Disruption Prediction (PS #3) & Continuous Supplier Risk Scoring (PS #9)

---

## 1. Strategic Purpose & Problem Statement

Global supply chains are non-linear, multi-tier dynamical networks. Traditional Enterprise Resource Planning (ERP) systems and Business Intelligence dashboards suffer from three fundamental deficiencies:
1. **Latency:** Disruptions are identified days or weeks after physical choke point congestion begins.
2. **Epistemic Ambiguity:** Raw news feeds and OSINT signals generate massive alert fatigue because they lack formal mathematical calibration and log-likelihood weighting.
3. **Decoupled Impact:** Intelligence dashboards do not trace physical maritime and geopolitical disruptions into plant-floor Bill of Materials (BOM), SKU inventories, and customer purchase orders.

**Sarvadarshi** resolves these problems by providing an integrated, end-to-end decision support command center that answers four critical operational questions in under two minutes:
> **1. What is going wrong? (External Disruption Discovery)**  
> **2. Why does it matter to us? (Multi-Tier BOM Propagation & Revenue-at-Risk)**  
> **3. When will it hurt? (Kalman Filter 14-Day Trajectory Fan & Stockout Horizon)**  
> **4. What action will reduce the damage? (Ranked Mitigation Optimization)**

---

## 2. High-Level Architecture & End-to-End Dataflow

Sarvadarshi operates across four tightly coupled architectural layers:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             1. SENSOR FUSION & INGESTION LAYER                           │
│  • Marine AIS Transponders (Vessel Traffic, Speed, Heading, Loitering Anomalies)        │
│  • OpenSky Network ADS-B Stream (Cargo Aircraft, Flight Corridors, Velocity, Alt)        │
│  • USGS Seismic Feed (Real-Time Global Earthquake Geometries & Magnitudes)              │
│  • GDACS & Open-Meteo Weather Advisories (Cyclone Trajectories, Port Wind Stress)        │
│  • Yahoo Finance Telemetry (Brent Crude, WTI, Baltic Dry BDRY, Semiconductors SMH, FX)   │
│  • OSINT / Maritime News RSS (Notice to Mariners, Naval Exercises, Labor Strikes)        │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                         2. INGESTION, SANITIZATION & NORMALIZATION                        │
│  • Outlier Clamping & Normalization (Elimination of divide-by-zero signal artifacts)      │
│  • Entity Resolution & Spatial Snapping (Coordinate-to-Chokepoint / Port Association)    │
│  • SQLite Canonical Event & Signal Archival (events.db, signals.db)                      │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                      3. PROBABILISTIC INFERENCE & GRAPH ONTOLOGY ENGINE                  │
│  • Bayesian Log-Likelihood Ratio (LLR) Posterior Stress Updates                          │
│  • 14-Day Kalman State Estimation (P50 Median, P80 Elevated, P95 Tail Risk Trajectories) │
│  • Multi-Tier BOM Propagation: Chokepoint ➔ Lane ➔ Supplier ➔ Part ➔ SKU ➔ Orders       │
│  • Monte Carlo Operational Runway Simulation (Hours-to-Stockout Distribution)            │
│  • Epistemic Marker Attribution ([OBSERVED], [INFERRED], [PREDICTED], [SIMULATED])       │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                     4. PRESENTATION & OPERATIONAL COMMAND LAYER                          │
│  • 3D Command Globe (Three.js WebGL Night Earth, AIS Anomalies, Corridors, Starfield)    │
│  • 2D Tactical Sub-Meter Drill-Down (CartoDB Dark & OSM Grayscale, Berth Reticle, rings)│
│  • Operational Control Tower & Decision Console (Executive KPIs, BOM Exposure, Actions)  │
│  • AI Operational Analyst (Grounded Zero-Hallucination LLM Agentic Query Loop)           │
│  • Enterprise Admin & Custom 3PL Builder (Register bespoke routes & logistics partners)  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Epistemic Verification & Zero-Hallucination Framework

To guarantee decision-grade reliability during military and enterprise operations, every data point presented in Sarvadarshi carries strict epistemic status markers:

| Epistemic Tag | Definition | Example Telemetry |
|---|---|---|
| `[OBSERVED]` | Direct physical measurement from verified upstream hardware transponder or sensor. | Vessel GPS coordinates from AIS, aircraft velocity from ADS-B, USGS magnitude, spot crude oil price. |
| `[INFERRED]` | Mathematical state computed via deterministic graph traversal or Bayesian evidence integration. | Chokepoint stress level, supplier criticality index, multi-tier BOM dependency chain. |
| `[PREDICTED]` | Probabilistic forward projection computed via calibrated state-space or statistical time-series models. | 14-day Kalman trajectory fan ($P_{50}, P_{80}, P_{95}$ delay in days), expected stockout date. |
| `[SIMULATED]` | Synthetic counterfactual scenario generated via Monte Carlo diffusion or user stress injection. | Port total closure shock, supplier complete failure scenario, lead-time variance impact. |

---

## 4. Core Domain Model & Relational Ontology

The ontology connects macroeconomic physical reality with enterprise microeconomics:

```
[Chokepoint / Maritime Hub] 
         │ (traversed by)
         ▼
     [Shipping Lane] 
         │ (serves)
         ▼
     [Tier-1 / Tier-2 Supplier] 
         │ (manufactures)
         ▼
     [Critical Part / Component] 
         │ (assembled into)
         ▼
     [Plant SKU / Product] 
         │ (fulfills)
         ▼
   [Customer Purchase Order] ──▶ Revenue at Risk & Contractual Late Penalty
```

### Key Entities
1. **Chokepoints (`GlobeChokepoint`):** Strategic maritime and land transit hubs (e.g. Strait of Malacca, Suez Canal, Strait of Hormuz, Bab el-Mandeb, Port of Singapore). Attributes: `stress_level` (0.0 to 1.0), `baseline_vessels_day`, `throughput_pct`, `confidence`.
2. **Impact Edges (`GlobeImpactEdge`):** Directed network dependencies between transit hubs modeling cascading congestion propagation.
3. **Suppliers (`Supplier`):** Vendors categorized by Tier (1, 2, 3), country of origin, single-source dependency flag, and annual spend.
4. **Parts (`Part`):** Components mapped to supplier IDs, criticality ratings, and lead times.
5. **SKUs (`SKU`):** Finished goods requiring specific sets of parts, daily demand burn rate, on-hand inventory, and safety buffer days.
6. **Customer Orders (`CustomerOrder`):** Downstream purchase orders bound to customer contracts with promised delivery dates, revenue values, and contractual daily late penalties.
7. **Custom Supply Chains (`CustomSupplyChain`):** Enterprise-defined corridors mapping origin nodes, intermediate transshipment hubs, 3PL partners (Maersk, DHL, Kuehne+Nagel), and destination assembly plants.

---

## 5. Mathematical Formulations

### 5.1 Bayesian Log-Likelihood Ratio (LLR) Updating
Stress levels for nodes are maintained as log-odds and updated upon receipt of corroborating evidence:
$$L_t = L_{t-1} + \sum_{i=1}^{M} \text{LLR}_i$$
$$\text{LLR}_i = \ln \left( \frac{P(E_i \mid \text{Disruption})}{P(E_i \mid \neg\text{Disruption})} \right) \times w_i \times c_i$$
where:
- $w_i \in [0, 1]$ is the source reliability weight.
- $c_i \in [0, 1]$ is the source confidence rating.
- The posterior disruption probability is mapped via logistic sigmoid:
$$P(\text{Disruption} \mid \mathbf{E}) = \frac{1}{1 + e^{-L_t}}$$

### 5.2 14-Day Kalman Trajectory Fan
The trajectory of future transit delay is estimated using a discrete-time linear dynamical system:
$$x_k = A x_{k-1} + w_k, \quad w_k \sim \mathcal{N}(0, Q)$$
$$y_k = H x_k + v_k, \quad v_k \sim \mathcal{N}(0, R)$$
Forward projections compute the quantile trajectory fan:
$$\text{Delay}_{P50}(t) = \hat{x}_t$$
$$\text{Delay}_{P80}(t) = \hat{x}_t + 0.842 \sqrt{P_t}$$
$$\text{Delay}_{P95}(t) = \hat{x}_t + 1.645 \sqrt{P_t}$$

### 5.3 Monte Carlo Inventory Runway & Stockout Timing
For an impacted SKU with daily demand $D \sim \mathcal{N}(\mu_d, \sigma_d^2)$ and replenishment lead time $L \sim \text{Kalman}(P_{80})$:
$$T_{\text{runway}} = \frac{I_{\text{on-hand}}}{\mu_d}$$
$$\text{Stockout Probability} = P\left( \sum_{t=1}^{L} D_t > I_{\text{on-hand}} \right)$$
$$\text{Revenue at Risk} = \sum_{o \in \mathcal{O}_{\text{exposed}}} \left( V_o + P_{\text{late}} \times \max(0, L - T_{\text{buffer}}) \right)$$

---

## 6. Operational Route Summary

- **`/command`**: 3D Disruption Command Globe, live AIS/ADS-B streams, market benchmarks ticker, disruption queue, and tracked chokepoints inventory table.
- **`/analyst`**: Grounded zero-hallucination AI Operational Analyst powered by Gemini API / OpenRouter with multi-turn graph querying.
- **`/control-tower`**: Executive KPI telemetry, real-time disruption status, and high-level enterprise exposure metrics.
- **`/console`**: Operational decision console with interactive BOM cascades, customer order impact matrices, and ranked mitigation playbooks.
- **`/exposure`**: Detailed SKU and purchase order ledger quantifying exact revenue at risk and customer SLA penalty exposure.
- **`/forecast`**: 14-day Kalman disruption trajectory fan with auditable Bayesian evidence ledger.
- **`/suppliers`**: Multi-dimensional vendor health scoring across delivery, quality, financial, capacity, compliance, and concentration.
- **`/scenarios`**: Monte Carlo scenario sandbox for custom stress testing and port closure simulations.
- **`/admin`**: Enterprise data portal for registering custom BOM structures, customer orders, and custom 3PL supply chain routes.
