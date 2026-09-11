/** Typed API client for the Sarvadarshi backend. */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

async function fetchJSON<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Alert / Disruption endpoints ─────────────────────────────────────────────

export async function getAlerts() {
  const resp = await fetchJSON<ApiEnvelope<Alert[]>>('/v1/alerts');
  return resp.data;
}

export async function getAlertDetail(alertId: string) {
  const resp = await fetchJSON<ApiEnvelope<Alert>>(`/v1/alerts/${alertId}`);
  return resp.data;
}

export async function getExposure(alertId?: string) {
  const params = alertId ? `?alert_id=${alertId}` : '';
  const resp = await fetchJSON<ApiEnvelope<ExposureRow[]>>(`/v1/exposure${params}`);
  return resp.data;
}

// ── Supplier risk endpoints ─────────────────────────────────────────────────

export async function getSuppliers() {
  const resp = await fetchJSON<ApiEnvelope<Supplier[]>>('/v1/suppliers');
  return resp.data;
}

export async function getSupplierRisk(supplierId: string) {
  const resp = await fetchJSON<ApiEnvelope<SupplierRiskScore>>(`/v1/suppliers/${supplierId}/risk`);
  return resp.data;
}

// ── Map / layers ─────────────────────────────────────────────────────────────

export async function getMapLayers() {
  const resp = await fetchJSON<ApiEnvelope<GeoJSON.FeatureCollection>>('/v1/map/layers');
  return resp.data;
}

// ── Stress tests ─────────────────────────────────────────────────────────────

export async function runStressTest(req: StressTestRequest) {
  const resp = await fetchJSON<ApiEnvelope<StressTestResult>>('/v1/stress-tests', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return resp.data;
}

// ── Concentration ────────────────────────────────────────────────────────────

export async function getConcentration() {
  const resp = await fetchJSON<ApiEnvelope<ConcentrationInfo>>('/v1/concentration');
  return resp.data;
}

// ── Demo / fixtures ──────────────────────────────────────────────────────────

export async function resetDemo() {
  const resp = await fetchJSON<ApiEnvelope<{ accepted: number; deduplicated: number }>>('/v1/demo/reset', {
    method: 'POST',
  });
  return resp.data;
}

export async function getDemoLocations() {
  const resp = await fetchJSON<ApiEnvelope<DemoLocation[]>>('/v1/demo/locations');
  return resp.data;
}

export async function getDemoNodes() {
  const resp = await fetchJSON<ApiEnvelope<DemoNode[]>>('/v1/demo/nodes');
  return resp.data;
}

export async function getDemoDependencies() {
  const resp = await fetchJSON<ApiEnvelope<DemoDependency[]>>('/v1/demo/dependencies');
  return resp.data;
}

// ── Ingestion ────────────────────────────────────────────────────────────────

export async function ingestLive() {
  const resp = await fetchJSON<ApiEnvelope<{ runs: any[] }>>('/v1/ingest/live', { method: 'POST' });
  return resp.data;
}
