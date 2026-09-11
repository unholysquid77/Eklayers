# I/O contract and mathematical engine formats

All timestamps are ISO-8601 UTC; identifiers are opaque tenant-scoped strings; probability-like values are floats in `[0,1]`; monetary values include ISO currency. API envelopes are `{ "data": ..., "as_of": "...", "model_version": "...", "provenance": [...] }`.

## Signal ingestion

`POST /v1/ingest/signals` accepts an array of `RiskSignal` objects:

```json
{"id":"gdacs-123","type":"weather_advisory","source":"GDACS","source_url":"https://...","observed_at":"2026-09-11T08:00:00Z","geometry":{"type":"Point","coordinates":[103.8,1.3]},"entities":[{"kind":"port","id":"port-singapore","match_confidence":0.94}],"intensity":0.72,"confidence":0.85,"raw_payload_hash":"sha256:..."}
```

`type` includes `weather_advisory`, `public_advisory`, `port_congestion`, `vessel_delay`, `route_closure`, `unrest`, `sanction`, `quality_event`, `capacity_event` and `financial_event`. The normalizer returns accepted, deduplicated and quarantined counts plus a reason for every quarantine.

## Operational ingestion

`POST /v1/ingest/operational` accepts `suppliers`, `supplier_metrics`, `parts`, `skus`, `bom_edges`, `lanes`, `shipments`, `inventory_positions` and `orders`. A BOM edge requires `upstream_id`, `downstream_id`, `quantity`, `lead_time_days`, `approved_alternate_ids`; an inventory position requires `node_id`, `on_hand`, `daily_demand`, `safety_stock`. Inventory days cover is `(on_hand - safety_stock) / max(daily_demand, epsilon)`.

## Fixture data

### Signals (11 total)

| Signal ID | Type | Source | Location | Intensity | Description |
|---|---|---|---|---|---|
| wx-storm-001 | weather_advisory | weather-gov | Shanghai Port (31.2N, 121.5E) | 0.85 | Tropical Storm Bolaven approaching East China Sea |
| wx-quake-001 | weather_advisory | USGS | Kaohsiung Port (22.6N, 120.3E) | 0.60 | M5.8 earthquake near southern Taiwan |
| wx-typhoon-001 | weather_advisory | GDACS | Manila Port (14.6N, 120.9E) | 0.75 | Category 2 typhoon making landfall in Philippines |
| log-singapore-001 | port_congestion | singapore-maritime | Singapore (1.3N, 103.8E) | 0.90 | Port of Singapore severe congestion, 3-5 day delays |
| log-suez-001 | route_closure | shipping-gov | Suez Canal (30.6N, 32.3E) | 0.55 | Suez Canal alert: potential navigation restrictions |
| log-europe-001 | public_advisory | logistics-europe | Antwerp Port (51.3N, 4.4E) | 0.70 | Belgium port workers strike affecting Antwerp and Zeebrugge |
| news-semiconductor-001 | capacity_event | reuters | Shenzhen (22.5N, 114.1E) | 0.80 | Major semiconductor shortage expected in Q3 2026 |
| news-tariff-001 | public_advisory | trade-news | Washington DC (38.9N, 77.0E) | 0.65 | US-China trade tensions escalate, new tariffs announced |
| news-customs-001 | public_advisory | logistics-europe | Rotterdam (51.9N, 4.5E) | 0.50 | New EU customs regulations causing delays at Rotterdam |
| news-eastcoast-001 | public_advisory | freightwaves | New York (40.7N, 74.0E) | 0.85 | East Coast port strike enters third week, major backlog |
| news-rare-earth-001 | capacity_event | reuters | Beijing (39.9N, 116.4E) | 0.70 | Rare earth export restrictions to impact global supply chains |

### Locations (10 ports)

| Port ID | Name | Coordinates | Congestion | Hazard |
|---|---|---|---|---|
| port-singapore | Singapore | 1.264, 103.840 | 0.7 | 0.3 |
| port-shanghai | Shanghai | 31.230, 121.474 | 0.8 | 0.6 |
| port-rotterdam | Rotterdam | 51.922, 4.479 | 0.4 | 0.2 |
| port-los-angeles | Los Angeles | 33.740, -118.260 | 0.5 | 0.2 |
| port-hamburg | Hamburg | 53.551, 9.993 | 0.3 | 0.1 |
| port-busan | Busan | 35.180, 129.075 | 0.4 | 0.3 |
| port-dubai | Dubai | 25.285, 55.320 | 0.3 | 0.4 |
| port-antwerp | Antwerp | 51.219, 4.402 | 0.9 | 0.5 |
| port-felixstowe | Felixstowe | 51.961, 1.351 | 0.6 | 0.2 |
| port-hong-kong | Hong Kong | 22.319, 114.169 | 0.5 | 0.5 |

### Operational nodes (15)

| Node | Type | Location | Risk Profile |
|---|---|---|---|
| acme-electronics | supplier | Shenzhen | quality: 0.8, delivery: 0.7, financial: 0.9 |
| precision-metals | supplier | Shanghai | quality: 0.9, delivery: 0.8, financial: 0.85 |
| shenzhen-semi | supplier | Shenzhen | quality: 0.6, delivery: 0.5, financial: 0.7 |
| logistics-gmbh | supplier | Hamburg | quality: 0.95, delivery: 0.9, financial: 0.95 |
| reliable-circuits | supplier | Tokyo | quality: 0.85, delivery: 0.8, financial: 0.9 |
| chip-brd | part | - | - |
| resistor-10k | part | - | - |
| steel-housing | part | - | - |
| battery-cell | part | - | - |
| pcb-4layer | part | - | - |
| connector-usb | part | - | - |
| led-indicator | part | - | - |
| sensor-temp | part | - | - |
| widget-pro | sku | - | - |
| widget-lite | sku | - | - |
| widget-mini | sku | - | - |
| corp-acme | customer | - | - |

### Dependencies (14 edges)

| Upstream | Downstream | Type | Probability | Multiplier |
|---|---|---|---|---|
| acme-electronics | chip-brd | supplies | 0.85 | 0.9 |
| precision-metals | steel-housing | supplies | 0.9 | 0.85 |
| shenzhen-semi | battery-cell | supplies | 0.7 | 0.95 |
| logistics-gmbh | pcb-4layer | logistics | 0.88 | 0.8 |
| reliable-circuits | sensor-temp | supplies | 0.82 | 0.88 |
| chip-brd | widget-pro | assembly | 0.95 | 0.7 |
| steel-housing | widget-pro | assembly | 0.92 | 0.6 |
| battery-cell | widget-pro | assembly | 0.88 | 0.75 |
| pcb-4layer | widget-lite | assembly | 0.9 | 0.65 |
| connector-usb | widget-lite | assembly | 0.85 | 0.7 |
| led-indicator | widget-mini | assembly | 0.87 | 0.6 |
| sensor-temp | widget-mini | assembly | 0.83 | 0.72 |
| widget-pro | corp-acme | logistics | 0.93 | 0.8 |
| widget-lite | corp-acme | logistics | 0.91 | 0.75 |

## Math engine inputs and outputs

### Bayesian update

```python
bayesian_update(subject_id, prior, evidence[])
```

`evidence[]`: `[{name, llr, weight, source, confidence}]`

Returns: `{posterior, alpha, beta, evidence_count, total_llr}`

Formula: `logit(p*) = logit(p0) + Σ(llr × weight × confidence)`; `alpha=p*×k`, `beta=(1-p*)×k`, where `k` grows with independent evidence.

### Prior calculation

```python
prior_for_node(kind, criticality, horizon_days)
```

Starting 90-day priors: 4% for port/lane/route, 3% for supplier/material, 2% for part/SKU, 1% for order. Criticality scales by `0.5 + criticality`. Horizon adjustment: `1 - (1-p)^(days/90)`.

### Node stress

```python
node_stress([(intensity, confidence, age_days), ...])
```

Formula: `stress = 1 - Π(1 - intensity×confidence×2^(-age/half_life))`

Half-life: 30 days. Bounded corroboration union.

### Kalman lead-time

```python
KalmanLeadTime(mean_days, variance, process_variance).update(observed_days, observation_variance)
```

Returns: `{p50_days, p80_days, p95_days, std_days}`

State-space: `x_t=x_(t-1)+w`, `z_t=x_t+v`. Forward variance: `P+hQ`.

### Monte Carlo exposure

```python
monte_carlo_exposure(seed_id, [alpha,beta], nodes, dependencies, trials=500, rng_seed=42, forced_failure=False)
```

Returns per-node: `{probability_affected, expected_impact, p50_stockout_days, p95_stockout_days}`

Edges: `{upstream_id, downstream_id, propagation_probability, impact_multiplier}`

`forced_failure=True` is the PS #3 stress-test mode for a lost supplier, port or route.

### False-alarm metrics

```python
false_alarm_metrics(outcomes, threshold)
```

`outcomes[]`: `[{probability, occurred, source}]`

Returns: `{precision, false_positives, brier_score, source_penalties}`

Suppress or down-weight a source only after a configurable minimum resolved sample size (default 20).

## Read APIs

| Endpoint | Response |
|---|---|
| `GET /v1/alerts` | Alert cards with posterior, severity, p50/p80/p95, affected SKU/order counts, evidence ledger |
| `GET /v1/alerts/{id}` | Single alert detail |
| `GET /v1/exposure?alert_id=` | Exposure graph/table |
| `GET /v1/suppliers` | All suppliers with risk scores |
| `GET /v1/suppliers/{id}/risk` | 0-100 score, delta, factor ledger, concentration, tier-two dependency status |
| `POST /v1/stress-tests` | First-stock-out distribution, impacted SKUs/orders, ranked mitigations |
| `GET /v1/concentration` | Concentration risk analysis |
| `GET /v1/map/layers` | GeoJSON layers for globe |
