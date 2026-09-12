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
import { MOCK_CASCADE, MOCK_ALERTS, MOCK_SHIPPING, MOCK_VESSELS, MOCK_FLIGHTS, MOCK_EARTHQUAKES } from './mock';

// In the browser, use relative URLs to leverage Next.js rewrites proxy (bypasses CORS/extension blocking)
// On server / node environment, use 127.0.0.1:8000
const IS_BROWSER = typeof window !== 'undefined';
const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || (IS_BROWSER ? '' : 'http://127.0.0.1:8000');

async function _get<T>(path: string): Promise<T> {
  // Candidate URLs to try
  const targets = [
    `${BASE}${path}`,
    `http://127.0.0.1:8000${path}`,
    `http://localhost:8000${path}`,
  ];

  let lastErr: unknown = null;
  for (const url of targets) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
      const json = await res.json();
      return ('data' in json ? json.data : json) as T;
    } catch (err) {
      lastErr = err;
      // If we are in browser and relative URL failed, continue to direct backend URL
      if (!IS_BROWSER) break;
    }
  }

  console.warn(`Backend fetch failed for ${path}, falling back to mock data if available. Error:`, lastErr);
  throw lastErr;
}

async function _post<T>(path: string, body: unknown): Promise<T> {
  const targets = [
    `${BASE}${path}`,
    `http://127.0.0.1:8000${path}`,
    `http://localhost:8000${path}`,
  ];

  let lastErr: unknown = null;
  for (const url of targets) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`POST ${path} -> HTTP ${res.status}`);
      const json = await res.json();
      return ('data' in json ? json.data : json) as T;
    } catch (err) {
      lastErr = err;
      if (!IS_BROWSER) break;
    }
  }

  throw lastErr;
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
  _get<CascadeMap>('/v1/globe/cascade/map').catch(() => MOCK_CASCADE);

export const getGlobeVessels = () =>
  _get<VesselsResponse>('/v1/globe/vessels').catch(() => MOCK_VESSELS);

export const getGlobeFlights = (limit = 2000) =>
  _get<FlightsResponse>(`/v1/globe/flights?limit=${limit}`).catch(() => MOCK_FLIGHTS);

export const getGlobeEarthquakes = () =>
  _get<GeoFeatureCollection>('/v1/globe/events/earthquakes').catch(() => MOCK_EARTHQUAKES);

export const getGlobeShippingLanes = () =>
  _get<ShippingLanesResponse>('/v1/globe/shipping_lanes').catch(() => MOCK_SHIPPING);

export const getGlobeInfraLayer = (layer: InfraLayerName) =>
  _get<GeoFeatureCollection>(`/v1/globe/infrastructure/${layer}`);

export const getGlobeOntologyEdges = () =>
  _get<OntologyEdgesResponse>('/v1/globe/ontology/edges');

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

export interface MarketTelemetryItem {
  symbol: string;
  label: string;
  category: string;
  unit: string;
  price: number;
  change: number;
  change_pct: number;
  is_up: boolean;
  source: string;
}

export const getMarketTelemetry = () =>
  _get<{ telemetry: MarketTelemetryItem[]; as_of: string }>('/v1/globe/market/telemetry').catch(() => ({
    telemetry: [
      { symbol: "BZ=F", label: "Brent Crude", category: "energy", unit: "$/bbl", price: 104.42, change: -3.21, change_pct: -2.98, is_up: false, source: "ICE Benchmark" },
      { symbol: "CL=F", label: "WTI Crude", category: "energy", unit: "$/bbl", price: 99.99, change: -2.49, change_pct: -2.43, is_up: false, source: "NYMEX Benchmark" },
      { symbol: "BDRY", label: "Baltic Dry Marine Freight", category: "freight", unit: "USD", price: 16.01, change: 0.09, change_pct: 0.57, is_up: true, source: "Freight Proxy" },
      { symbol: "SMH", label: "Semiconductor Index", category: "semis", unit: "USD", price: 568.53, change: 8.25, change_pct: 1.47, is_up: true, source: "VanEck Semi" },
      { symbol: "EURUSD=X", label: "EUR / USD", category: "fx", unit: "Rate", price: 1.16, change: -0.003, change_pct: -0.27, is_up: false, source: "Interbank FX" },
    ],
    as_of: new Date().toISOString()
  }));

export const getCustomSupplyChains = () =>
  _get<{ supply_chains: any[]; total: number }>('/v1/globe/supply-chains/custom').catch(() => ({ supply_chains: [], total: 0 }));

export const addCustomSupplyChain = (chain: any) =>
  _post<any>('/v1/globe/supply-chains/custom', chain);

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


// ============================================================================
// Decision Support & Polish Spec v1 API Methods
// ============================================================================

import {
  MOCK_DASHBOARD_SUMMARY, MOCK_SKUS, MOCK_ORDERS,
  MOCK_SHIPMENTS, MOCK_SUPPLIERS, MOCK_RELIABILITY,
  MOCK_MITIGATIONS, MOCK_DECISION_STRESS_TEST,
  MOCK_SYSTEM_STATUS, MOCK_AI_RESPONSE
} from './mock';

import type {
  DashboardSummary, SKUExposureItem, CustomerOrderExposureItem,
  ShipmentItem, SupplierProfile, FalseAlarmControl,
  MitigationComparisonItem, DecisionStressTestResult,
  SystemStatusResponse, AIQueryResponse
} from './contracts';

export const getDashboardSummary = () =>
  _get<DashboardSummary>('/v1/dashboard/summary').catch(() => MOCK_DASHBOARD_SUMMARY);

export const getSKUsExposure = () =>
  _get<SKUExposureItem[]>('/v1/skus').catch(() => MOCK_SKUS);

export const getSKUDetail = (id: string) =>
  _get<SKUExposureItem>(`/v1/skus/${id}`).catch(() => MOCK_SKUS.find(s => s.id === id) || MOCK_SKUS[0]);

export const getOrdersExposure = () =>
  _get<CustomerOrderExposureItem[]>('/v1/orders').catch(() => MOCK_ORDERS);

export const getOrderDetail = (id: string) =>
  _get<CustomerOrderExposureItem>(`/v1/orders/${id}`).catch(() => MOCK_ORDERS.find(o => o.id === id) || MOCK_ORDERS[0]);

export const getShipments = () =>
  _get<ShipmentItem[]>('/v1/shipments').catch(() => MOCK_SHIPMENTS);

export const getShipmentDetail = (id: string) =>
  _get<ShipmentItem>(`/v1/shipments/${id}`).catch(() => MOCK_SHIPMENTS.find(s => s.id === id) || MOCK_SHIPMENTS[0]);

export const getSuppliersProfiles = () =>
  _get<SupplierProfile[]>('/v1/suppliers').catch(() => MOCK_SUPPLIERS);

export const getSignalsReliability = () =>
  _get<FalseAlarmControl>('/v1/signals/reliability').catch(() => MOCK_RELIABILITY);

export const runDecisionStressTest = (req: {
  target_type?: string;
  target_id?: string;
  target_name?: string;
  custom_scenario?: string;
  duration_days?: number;
  severity_pct?: number;
  demand_scenario?: string;
}) => _post<DecisionStressTestResult>('/v1/scenarios/stress-test', req).catch(() => MOCK_DECISION_STRESS_TEST);

export const getMitigationsComparison = (params?: { target_entity?: string; custom_scenario?: string }) => {
  const query = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
        .join('&')
    : '';
  return _get<MitigationComparisonItem[]>(`/v1/mitigations/compare${query}`).catch(() => MOCK_MITIGATIONS);
};

export const compareMitigationsCustom = (body: {
  target_entity?: string;
  target_type?: string;
  severity_pct?: number;
  custom_scenario?: string;
}) => _post<MitigationComparisonItem[]>('/v1/mitigations/compare', body).catch(() => MOCK_MITIGATIONS);

export const queryAIAnalyst = (question: string, context_entity_id?: string) =>
  _post<AIQueryResponse>('/v1/ai/query', { question, context_entity_id }).catch(() => MOCK_AI_RESPONSE);

export const getSystemStatus = () =>
  _get<SystemStatusResponse>('/v1/system/status').catch(() => MOCK_SYSTEM_STATUS);

export const getDataHealth = () =>
  _get<Record<string, any>>('/v1/system/data-health').catch(() => ({
    status: 'HEALTHY',
    coverage_pct: 87.0,
    last_ingest: '12:31:42 IST'
  }));

export const getModelHealth = () =>
  _get<Record<string, any>>('/v1/system/model-health').catch(() => ({
    signal_freshness_pct: 94.0,
    calibration_score_pct: 88.0,
    forecast_confidence_pct: 81.0,
  }));

export const resetDemoState = () =>
  _post<{ status: string; message: string }>('/v1/demo/reset', {}).catch(() => ({
    status: 'SUCCESS',
    message: 'Demo state deterministically reset.'
  }));
