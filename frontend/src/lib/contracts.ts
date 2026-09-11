/** Typed contracts for the Sarvadarshi API. */

// ── API envelope ─────────────────────────────────────────────────────────────

export interface ApiEnvelope<T> {
  data: T;
  as_of: string;
  model_version: string;
  provenance: string[];
}

// ── Alert / Disruption ───────────────────────────────────────────────────────

export interface Alert {
  id: string;
  subject: string;
  signal_type: string;
  source: string;
  posterior: number;
  prior: number;
  severity: number;
  observed_at: string;
  evidence: AlertEvidence[];
}

export interface AlertEvidence {
  name: string;
  llr: number;
  contribution: number;
}

// ── Exposure ─────────────────────────────────────────────────────────────────

export interface ExposureRow {
  node_id: string;
  probability_affected: number;
  expected_impact: number;
  p50_stockout_days: number | null;
  p95_stockout_days: number | null;
}

// ── Supplier risk ────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  kind: string;
  latitude: number;
  longitude: number;
  country_code: string;
}

export interface SupplierRiskScore {
  supplier_id: string;
  score_0_100: number;
  dimension_scores: {
    disruption_probability: number;
    lead_time_risk: number;
    concentration_risk: number;
    financial_risk: number;
  };
  delta_7d: number;
  confidence: number;
  factor_ledger: FactorEntry[];
}

export interface FactorEntry {
  factor: string;
  contribution: number;
  source: string;
}

// ── Stress test ──────────────────────────────────────────────────────────────

export interface StressTestRequest {
  target_id: string;
  target_kind?: string;
  trials?: number;
  rng_seed?: number;
  forced_failure?: boolean;
}

export interface StressTestResult {
  target_id: string;
  exposure: ExposureRow[];
  mitigations: Mitigation[];
}

export interface Mitigation {
  node: string;
  stockout_days: number | null;
  mitigation: string;
}

// ── Concentration ────────────────────────────────────────────────────────────

export interface ConcentrationInfo {
  suppliers: number;
  ports: number;
  lanes: number;
  herfindahl_index: number;
  single_source_risk: string;
}

// ── Demo fixtures ────────────────────────────────────────────────────────────

export interface DemoLocation {
  id: string;
  kind: string;
  latitude: number;
  longitude: number;
  country_code: string;
}

export interface DemoNode {
  id: string;
  kind: string;
  criticality: number;
  inventory_days?: number;
}

export interface DemoDependency {
  upstream: string;
  downstream: string;
  propagation: number;
  impact: number;
}
