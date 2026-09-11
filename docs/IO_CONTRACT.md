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

## Math engine inputs and outputs

`bayesian_update(subject_id, prior, evidence[])` uses an `Evidence` item of `{name,llr,weight,source,confidence}` and returns a posterior with a Beta envelope. Formula: `logit(p*) = logit(p0) + Σ(llr × weight × confidence)`; `alpha=p*×k`, `beta=(1-p*)×k`, where `k` grows with independent evidence.

`prior_for_node(kind, criticality, horizon_days)` supplies a conservative, category-specific prior. Starting 90-day priors are 4% for port/lane/route, 3% for supplier/material, 2% for part/SKU and 1% for order; criticality scales this by `0.5 + criticality`, then the result converts to the requested horizon. `node_stress([(intensity,confidence,age_days), ...])` calculates per-node live stress with exponential freshness decay and a bounded corroboration union: `stress = 1 - Π(1 - intensity×confidence×2^(-age/half_life))`.

`KalmanLeadTime(mean_days, variance, process_variance).update(observed_days, observation_variance)` emits `{p50_days,p80_days,p95_days,std_days}`. It uses `x_t=x_(t-1)+w`, `z_t=x_t+v`; its forward variance is `P+hQ`, so uncertainty explicitly widens with horizon.

`monte_carlo_exposure(seed_id, [alpha,beta], nodes, dependencies, trials, rng_seed, forced_failure)` returns per-node `{probability_affected,expected_impact,p50_stockout_days,p95_stockout_days}`. Edges provide `{upstream_id,downstream_id,propagation_probability,impact_multiplier}`. Fixed `rng_seed` is mandatory for a reproducible judged demo. `forced_failure=true` is the PS #3 stress-test mode for a lost supplier, port or route.

`false_alarm_metrics(outcomes, threshold)` accepts resolved `{probability,occurred,source}` forecasts and returns alert precision, false positives, Brier score and a source-specific false-alarm penalty. Suppress or down-weight a source only after a configurable minimum resolved sample size (default 20); never suppress it solely on a small sample.

## Read APIs

`GET /v1/alerts` returns alert cards with posterior, severity, p50/p80/p95 revised arrival date, affected SKU/order counts and an evidence ledger. `GET /v1/exposure?alert_id=` returns an exposure graph/table. `GET /v1/suppliers/{id}/risk` returns the 0–100 score, delta, factor ledger, concentration and tier-two dependency status. `POST /v1/stress-tests` accepts `{target_id,target_kind,trials,rng_seed}` and returns first-stock-out distribution, impacted SKUs/orders and ranked mitigations.
