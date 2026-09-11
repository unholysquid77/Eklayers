/**
 * Sarvadarshi — TypeScript contracts for backend API.
 */

export interface ApiEnvelope<T> {
  data: T;
  as_of: string;
  model_version: string;
  provenance: string[];
}

export interface Supplier {
  id: string; name: string; tier: number; country: string; region: string;
  lat: number | null; lon: number | null; categories: string[]; criticality: number;
}
export interface Part { id: string; name: string; supplier_id: string; category: string; criticality: number; }
export interface SKU { id: string; name: string; parts: string[]; daily_demand: number; }
export interface CustomerOrder { id: string; sku_id: string; quantity: number; priority: string; }
export interface Lane { id: string; name: string; from_hub: string; to_hub: string; transit_days: number; }
export interface InventoryPosition { node_id: string; on_hand: number; daily_demand: number; safety_stock: number; }

export interface EvidenceEntry { signal_id: string; signal_type: string; llr: number; description: string; }
export interface AlertCard {
  id: string; subject_id: string; title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  prior: number; posterior: number; delta: number;
  evidence: EvidenceEntry[]; created_at: string;
}
export interface ExposureNode { node_id: string; node_name: string; node_kind: string; depth: number; exposure_score: number; on_hand_days?: number; }
export interface ForecastDay { day: number; p50: number; p80: number; p95: number; }
export interface ChokepointForecast { chokepoint_id: string; chokepoint_name: string; horizon_days: number; threshold: number; breach_day_p50: number | null; breach_day_p80: number | null; forecast: ForecastDay[]; }

export interface DimensionScores { delivery: number; quality: number; financial: number; capacity: number; compliance: number; concentration: number; }
export interface FactorLedgerEntry { factor: string; value: number; contribution: number; direction: 'positive' | 'negative' | 'neutral'; }
export interface SupplierRiskScore { supplier_id: string; supplier_name: string; composite_score: number; dimension_scores: DimensionScores; factor_ledger: FactorLedgerEntry[]; delta_7d?: number; as_of: string; }
export interface ConcentrationResult { by_region: Record<string, number>; by_category: Record<string, number>; hhi_region: number; hhi_category: number; top_region: string; top_category: string; risk_level: 'low' | 'medium' | 'high' | 'critical'; }
export interface StressTestResult { scenario: string; disrupted_node: string; trials: number; mean_exposure: number; p95_exposure: number; affected_skus: string[]; revenue_at_risk: number; }
export interface MitigationOption { option: string; description: string; cost_estimate: number; lead_time_reduction_days: number; risk_score_delta: number; recommended: boolean; }

// Globe — Cascade
export interface GlobeChokepoint { id: string; name: string; category: string; latitude: number; longitude: number; stress_level: number; baseline: number; criticality: number; }
export interface GlobeEvent { id: string; latitude: number; longitude: number; domain: string; severity: number; event_category: string; occurred_at: string; raw_text: string; title: string; actor: string; object: string; location: string; source_ids: string[]; }
export interface ImpactEdge { from_chokepoint: string; to_entity_id: string; to_entity_name: string; severity: number; }
export interface CascadeMap { chokepoints: GlobeChokepoint[]; events: GlobeEvent[]; impact_edges: ImpactEdge[]; }

// Globe — Live feeds
export type VesselBucket = 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'mil';
export interface Vessel { mmsi: string; name: string; lat: number; lon: number; speed: number; heading: number; bucket: VesselBucket; }
export interface VesselsResponse { vessels: Vessel[]; connected: boolean; }
export interface Flight { icao: string; callsign: string; lat: number; lon: number; alt_m: number; vel_ms: number; heading: number; mil: boolean; country: string; on_ground: boolean; }
export interface FlightsResponse { flights: Flight[]; stale: boolean; }

// Globe — BOM arcs
export interface ArcEndpoint { id: string; lat: number; lon: number; name: string; kind: string; }
export interface RelationArc { id: string; label: string; severity: number; source: ArcEndpoint; target: ArcEndpoint; }
export interface OntologyEdgesResponse { arcs: RelationArc[]; total: number; }

// Globe — Infrastructure
export type InfraLayerName = 'ports' | 'airports' | 'warehouses' | 'refineries' | 'lng_terminals' | 'storage_facilities' | 'pipelines' | 'power_lines' | 'undersea_cables' | 'economic_centers' | 'data_centers' | 'nuclear_sites' | 'military_bases' | 'spaceports' | 'land_routes';
export const INFRA_LAYER_NAMES: InfraLayerName[] = ['ports','airports','warehouses','refineries','lng_terminals','storage_facilities','pipelines','power_lines','undersea_cables','economic_centers','data_centers','nuclear_sites','military_bases','spaceports','land_routes'];

// Globe — GeoJSON generics
export interface GeoFeature { type: 'Feature'; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown>; }
export interface GeoFeatureCollection { type: 'FeatureCollection'; features: GeoFeature[]; }

// Globe — Shipping lanes
export interface ShippingLaneProperties { id: string; name: string; route_type: string; baseline_stress: number; stress: number; traffic: string; chokepoint: boolean; }
export interface ShippingLane { type: 'Feature'; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: ShippingLaneProperties; }
export interface ShippingLanesResponse { type: 'FeatureCollection'; features: ShippingLane[]; }

// Globe — Layer visibility
export interface LayerVisibility {
  cascadeArcs: boolean; eventDots: boolean; chokepointPins: boolean; countryBorders: boolean;
  vessels: boolean; flights: boolean;
  shippingLanes: boolean; landRoutes: boolean;
  warehouses: boolean; ports: boolean; airports: boolean;
  pipelines: boolean; powerLines: boolean; refineries: boolean; lngTerminals: boolean; storageFacilities: boolean;
  underseaCables: boolean; economicCenters: boolean; dataCenters: boolean;
  nuclearSites: boolean; militaryBases: boolean; spaceports: boolean;
  earthquakes: boolean; acled: boolean; bomArcs: boolean;
}
export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  cascadeArcs: true, eventDots: true, chokepointPins: true, countryBorders: true,
  vessels: true, flights: false,
  shippingLanes: true, landRoutes: false,
  warehouses: true, ports: true, airports: false,
  pipelines: false, powerLines: false, refineries: false, lngTerminals: false, storageFacilities: false,
  underseaCables: false, economicCenters: false, dataCenters: false,
  nuclearSites: false, militaryBases: false, spaceports: false,
  earthquakes: true, acled: false, bomArcs: true,
};

// ---------------------------------------------------------------------------
// Console Dashboard Contracts
// ---------------------------------------------------------------------------

export interface ConsoleSummary {
  chokepoints_count: number;
  signals_count: number;
  forecasts_count: number;
  supply_chains_count: number;
  max_stress: number;
  average_weighted_stress: number;
}

export interface HistogramBin {
  days: number;
  count: number;
  probability: number;
}

export interface MonteCarloSimulationData {
  simulations: number;
  mean_disruption_days: number;
  percentiles: {
    p50: number;
    p90: number;
    p99: number;
  };
  histogram_data: HistogramBin[];
}

export interface ConsoleChokepoint {
  id: string;
  name: string;
  current_stress: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface ChokepointsResponse {
  chokepoints: ConsoleChokepoint[];
}

export interface ChokepointDetails {
  id: string;
  centrality_score: number;
  flow_capacity_variance: number;
  historical_stress_coefficient: number;
  vulnerability_index: number;
}

export interface ConsoleHeadline {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  related_chokepoints: string[];
  severity?: string;
  sentiment?: number;
}

export interface HeadlinesResponse {
  headlines: ConsoleHeadline[];
}

export interface ConsoleSignal {
  id: string;
  type: string;
  severity: string;
  description: string;
  precision_score: number;
  timestamp?: string;
}

export interface SignalsResponse {
  signals: ConsoleSignal[];
}

export interface DailyTrendPoint {
  day: number;
  date: string;
  predicted_stress: number;
  p50: number;
  p90: number;
}

export interface ConsoleStressForecast {
  current_score: number;
  highest_30d_forecast: number;
  peak_date: string;
  disruption_probability: number;
  daily_trend?: DailyTrendPoint[];
}

export interface BOMTraceNode {
  part_id: string;
  name: string;
  supplier: string;
  tier: number;
  lead_time_days: number;
  buffer_stock_days: number;
  risk_status: string;
}

export interface ConsoleSupplyChain {
  id: string;
  name: string;
  chokepoints: string[];
  travel_time_days: number;
  revised_arrival_date: string;
  stress: number;
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  disruption_probability: number;
  origin?: string;
  destination?: string;
  bom_trace?: BOMTraceNode[];
}

export interface SupplyChainsResponse {
  supply_chains: ConsoleSupplyChain[];
}

export interface ConsoleMitigation {
  type: string;
  recommendation: string;
  cost_impact: string;
  lead_time_reduction_days?: number;
}

export interface ConsoleAlert {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  related_chokepoint?: string;
  confidence?: number;
  mitigations: ConsoleMitigation[];
}

export interface ConsoleAlertsResponse {
  alerts: ConsoleAlert[];
}

export interface StressTestSimulateReq {
  target_type: 'PORT' | 'SUPPLIER' | 'ROUTE' | 'HUB';
  target_id: string;
}

export interface StressTestSimulateRes {
  simulation_id: string;
  target_type: string;
  target_id: string;
  target_name?: string;
  time_to_stock_out_days: number;
  cascading_effects: string[];
}
