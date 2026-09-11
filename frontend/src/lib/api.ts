/**
 * Sarvadarshi — typed API client.
 * All requests go to NEXT_PUBLIC_BACKEND_URL (default: http://localhost:8000).
 */
import type {
  AlertCard, SupplierRiskScore, ExposureNode, ChokepointForecast,
  ConcentrationResult, StressTestResult, MitigationOption,
  CascadeMap, VesselsResponse, FlightsResponse,
  OntologyEdgesResponse, ShippingLanesResponse, GeoFeatureCollection,
  InfraLayerName,
  ChokepointResearchReq, ChokepointResearchDossier,
} from './contracts';
import { MOCK_CASCADE, MOCK_ALERTS, MOCK_SHIPPING } from './mock';

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

async function _get<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path}   ${res.status}`);
    const json = await res.json();
    return ('data' in json ? json.data : json) as T;
  } catch (err) {
    console.warn(`Backend fetch failed for ${path}, falling back to mock data if available. Error:`, err);
    throw err; // let the specific functions handle their own fallbacks
  }
}

async function _post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  const json = await res.json();
  return ('data' in json ? json.data : json) as T;
}

// ---------------------------------------------------------------------------
// Supply chain core
// ---------------------------------------------------------------------------

export const getAlerts = () => _get<AlertCard[]>('/v1/alerts');
export const getAlert  = (id: string) => _get<AlertCard>(`/v1/alerts/${id}`);
export const getExposure = (alertId: string) => _get<ExposureNode[]>(`/v1/exposure?alert_id=${alertId}`);
export const getChokepointForecast = (nodeId: string) => _get<ChokepointForecast>(`/v1/chokepoints/${nodeId}/forecast`);

export const getSuppliers = () => _get<SupplierRiskScore[]>('/v1/suppliers');
export const getSupplierRisk = (id: string) => _get<SupplierRiskScore>(`/v1/suppliers/${id}/risk`);
export const getConcentration = () => _get<ConcentrationResult>('/v1/concentration');

export const runStressTest = (body: { scenario: string; disrupted_node: string }) =>
  _post<StressTestResult>('/v1/stress-tests', body);

export const getMitigations = (alertId: string) =>
  _post<MitigationOption[]>('/v1/mitigations/compare', { alert_id: alertId });

export const resetDemo = () => _post<{ status: string }>('/v1/demo/reset', {});
export const ingestLive = () => _post<unknown>('/v1/ingest/live', {});

// ---------------------------------------------------------------------------
// Globe feeds
// ---------------------------------------------------------------------------

export const getGlobeCascadeMap = () =>
  fetch(`${BASE}/v1/globe/cascade/map`, { cache: 'no-store' })
    .then(r => r.json())
    .catch(() => MOCK_CASCADE) as Promise<CascadeMap>;

export const getGlobeVessels = () =>
  fetch(`${BASE}/v1/globe/vessels`, { cache: 'no-store' })
    .then(r => r.json()) as Promise<VesselsResponse>;

export const getGlobeFlights = (limit = 2000) =>
  fetch(`${BASE}/v1/globe/flights?limit=${limit}`, { cache: 'no-store' })
    .then(r => r.json()) as Promise<FlightsResponse>;

export const getGlobeEarthquakes = () =>
  fetch(`${BASE}/v1/globe/events/earthquakes`, { cache: 'no-store' })
    .then(r => r.json()) as Promise<GeoFeatureCollection>;

export const getGlobeShippingLanes = () =>
  fetch(`${BASE}/v1/globe/shipping_lanes`, { cache: 'no-store' })
    .then(r => r.json()) as Promise<ShippingLanesResponse>;

export const getGlobeInfraLayer = (layer: InfraLayerName) =>
  fetch(`${BASE}/v1/globe/infrastructure/${layer}`, { cache: 'no-store' })
    .then(r => r.json()) as Promise<GeoFeatureCollection>;

export const getGlobeOntologyEdges = () =>
  fetch(`${BASE}/v1/globe/ontology/edges`, { cache: 'no-store' })
    .then(r => r.json()) as Promise<OntologyEdgesResponse>;

export const getGlobeChokepointForecast = (nodeId: string) =>
  _get<ChokepointForecast>(`/v1/globe/chokepoints/${nodeId}/forecast`);

// Bulk-fetch all infra layers in parallel
export const getAllInfraLayers = async (names: InfraLayerName[]) => {
  const results = await Promise.allSettled(names.map(n => getGlobeInfraLayer(n).then(d => [n, d] as [InfraLayerName, GeoFeatureCollection])));
  const out: Partial<Record<InfraLayerName, GeoFeatureCollection>> = {};
  for (const r of results) {
    if (r.status === 'fulfilled') out[r.value[0]] = r.value[1];
  }
  return out as Record<InfraLayerName, GeoFeatureCollection>;
};

// ---------------------------------------------------------------------------
// Console Dashboard APIs
// ---------------------------------------------------------------------------

import type {
  ConsoleSummary, MonteCarloSimulationData, ChokepointsResponse,
  ChokepointDetails, HeadlinesResponse, SignalsResponse,
  ConsoleStressForecast, SupplyChainsResponse, ConsoleAlertsResponse,
  StressTestSimulateReq, StressTestSimulateRes,
} from './contracts';

import {
  MOCK_CONSOLE_SUMMARY, MOCK_MONTE_CARLO, MOCK_CONSOLE_CHOKEPOINTS,
  MOCK_CHOKEPOINT_DETAILS, MOCK_HEADLINES, MOCK_SIGNALS,
  MOCK_STRESS_FORECAST, MOCK_SUPPLY_CHAINS, MOCK_CONSOLE_ALERTS,
  MOCK_SIMULATE_RESPONSE,
} from './mock';

export const getConsoleSummary = () =>
  _get<ConsoleSummary>('/api/console/summary').catch(() => MOCK_CONSOLE_SUMMARY);

export const getMonteCarloSimulations = () =>
  _get<MonteCarloSimulationData>('/api/console/simulations/monte-carlo').catch(() => MOCK_MONTE_CARLO);

export const getConsoleChokepoints = () =>
  _get<ChokepointsResponse>('/api/console/chokepoints').catch(() => ({ chokepoints: MOCK_CONSOLE_CHOKEPOINTS }));

export const getConsoleChokepointDetails = (id: string) =>
  _get<ChokepointDetails>(`/api/console/chokepoints/${id}/details`).catch(() => {
    return MOCK_CHOKEPOINT_DETAILS[id] || {
      id,
      centrality_score: 0.88,
      flow_capacity_variance: 0.16,
      historical_stress_coefficient: 1.15,
      vulnerability_index: 0.72,
    };
  });

export const getConsoleHeadlines = () =>
  _get<HeadlinesResponse>('/api/console/headlines').catch(() => ({ headlines: MOCK_HEADLINES }));

export const getConsoleSignals = () =>
  _get<SignalsResponse>('/api/console/signals').catch(() => ({ signals: MOCK_SIGNALS }));

export const getConsoleStressForecast = () =>
  _get<ConsoleStressForecast>('/api/console/stress/forecast').catch(() => MOCK_STRESS_FORECAST);

export const getConsoleSupplyChains = () =>
  _get<SupplyChainsResponse>('/api/console/supply-chains').catch(() => ({ supply_chains: MOCK_SUPPLY_CHAINS }));

export const getConsoleAlerts = () =>
  _get<ConsoleAlertsResponse>('/api/console/alerts').catch(() => ({ alerts: MOCK_CONSOLE_ALERTS }));

export const runConsoleStressTestSimulate = (req: StressTestSimulateReq) =>
  _post<StressTestSimulateRes>('/api/console/stress-test/simulate', req).catch(() => ({
    ...MOCK_SIMULATE_RESPONSE,
    target_type: req.target_type,
    target_id: req.target_id,
    target_name: req.target_id,
  }));

export const researchChokepoint = (req: ChokepointResearchReq) =>
  _post<ChokepointResearchDossier>('/v1/chokepoints/research', req);

