import type { CascadeMap, AlertCard, Vessel, Flight, GeoFeatureCollection } from "./contracts";

export const MOCK_CASCADE: CascadeMap = {
  chokepoints: [
    { id: "cp-1", name: "Suez Canal", category: "port", latitude: 30.5852, longitude: 32.2659, stress_level: 0.8, baseline: 0.2, criticality: 0.9 },
    { id: "cp-2", name: "Strait of Malacca", category: "transit", latitude: 4.1147, longitude: 100.13, stress_level: 0.5, baseline: 0.3, criticality: 0.8 },
  ],
  events: [
    { id: "evt-1", latitude: 31.0, longitude: 32.5, severity: 0.9, domain: "geopolitical", event_category: "Conflict", occurred_at: new Date().toISOString(), raw_text: "", title: "Canal Blockage", actor: "", object: "", location: "", source_ids: [] },
  ],
  impact_edges: [
    { from_chokepoint: "cp-1", to_entity_id: "cp-2", to_entity_name: "Strait of Malacca", severity: 0.8 }
  ]
};

export const MOCK_ALERTS: AlertCard[] = [
  { id: "al-1", subject_id: "cp-1", title: "Suez Canal Blockage", severity: "critical", prior: 0.2, posterior: 0.8, delta: 0.6, evidence: [], created_at: new Date().toISOString() }
];

export const MOCK_SHIPPING: GeoFeatureCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: { type: "LineString", coordinates: [[32.2659, 30.5852], [100.13, 4.1147]] }, properties: { name: "Asia-Europe", stress: 0.7 } }
  ]
};

// ---------------------------------------------------------------------------
// Console Mocks
// ---------------------------------------------------------------------------

import type {
  ConsoleSummary, MonteCarloSimulationData, ConsoleChokepoint,
  ChokepointDetails, ConsoleHeadline, ConsoleSignal,
  ConsoleStressForecast, ConsoleSupplyChain, ConsoleAlert,
  StressTestSimulateRes,
} from "./contracts";

export const MOCK_CONSOLE_SUMMARY: ConsoleSummary = {
  chokepoints_count: 124,
  signals_count: 89,
  forecasts_count: 42,
  supply_chains_count: 15,
  max_stress: 0.89,
  average_weighted_stress: 0.45,
};

export const MOCK_MONTE_CARLO: MonteCarloSimulationData = {
  simulations: 10000,
  mean_disruption_days: 12.4,
  percentiles: { p50: 10, p90: 21, p99: 45 },
  histogram_data: [
    { days: 0, count: 50, probability: 0.005 },
    { days: 2, count: 180, probability: 0.018 },
    { days: 4, count: 420, probability: 0.042 },
    { days: 6, count: 850, probability: 0.085 },
    { days: 8, count: 1420, probability: 0.142 },
    { days: 10, count: 1950, probability: 0.195 },
    { days: 12, count: 1720, probability: 0.172 },
    { days: 14, count: 1240, probability: 0.124 },
    { days: 16, count: 780, probability: 0.078 },
    { days: 18, count: 460, probability: 0.046 },
    { days: 20, count: 310, probability: 0.031 },
    { days: 22, count: 210, probability: 0.021 },
    { days: 24, count: 140, probability: 0.014 },
    { days: 26, count: 90, probability: 0.009 },
    { days: 28, count: 65, probability: 0.0065 },
    { days: 30, count: 45, probability: 0.0045 },
    { days: 35, count: 35, probability: 0.0035 },
    { days: 40, count: 20, probability: 0.002 },
    { days: 45, count: 12, probability: 0.0012 },
    { days: 50, count: 8, probability: 0.0008 },
  ],
};

export const MOCK_CONSOLE_CHOKEPOINTS: ConsoleChokepoint[] = [
  { id: "chk_007", name: "Bab-el-Mandeb Strait", current_stress: 0.88, trend: "increasing" },
  { id: "chk_001", name: "Panama Canal", current_stress: 0.85, trend: "increasing" },
  { id: "chk_002", name: "Suez Canal", current_stress: 0.82, trend: "increasing" },
  { id: "chk_003", name: "Strait of Malacca", current_stress: 0.74, trend: "stable" },
  { id: "chk_004", name: "Port of Shanghai", current_stress: 0.68, trend: "decreasing" },
  { id: "chk_005", name: "Strait of Hormuz", current_stress: 0.65, trend: "increasing" },
  { id: "chk_006", name: "Port of Rotterdam", current_stress: 0.58, trend: "stable" },
  { id: "chk_008", name: "Port of Singapore", current_stress: 0.52, trend: "decreasing" },
];

export const MOCK_CHOKEPOINT_DETAILS: Record<string, ChokepointDetails> = {
  chk_001: { id: "chk_001", centrality_score: 0.92, flow_capacity_variance: 0.15, historical_stress_coefficient: 1.24, vulnerability_index: 0.78 },
  chk_002: { id: "chk_002", centrality_score: 0.95, flow_capacity_variance: 0.22, historical_stress_coefficient: 1.45, vulnerability_index: 0.89 },
  chk_003: { id: "chk_003", centrality_score: 0.98, flow_capacity_variance: 0.10, historical_stress_coefficient: 1.12, vulnerability_index: 0.71 },
  chk_007: { id: "chk_007", centrality_score: 0.91, flow_capacity_variance: 0.35, historical_stress_coefficient: 1.82, vulnerability_index: 0.93 },
};

export const MOCK_HEADLINES: ConsoleHeadline[] = [
  { id: "news_123", title: "Port Strike Looms on US East Coast as Labor Negotiations Stagnate", source: "Reuters", timestamp: "2026-09-11T18:45:00Z", related_chokepoints: ["chk_045", "chk_001"], severity: "HIGH", sentiment: -0.65 },
  { id: "news_124", title: "Red Sea Shipping Reroutes via Cape of Good Hope Add 12 Days to Asia-Europe Transit", source: "Bloomberg", timestamp: "2026-09-11T17:15:00Z", related_chokepoints: ["chk_007", "chk_002"], severity: "CRITICAL", sentiment: -0.82 },
  { id: "news_125", title: "Severe Drought Lowers Gatun Lake Levels; Panama Canal Caps Daily Bookings at 24", source: "Lloyd's List", timestamp: "2026-09-11T15:30:00Z", related_chokepoints: ["chk_001"], severity: "HIGH", sentiment: -0.70 },
  { id: "news_126", title: "Super Typhoon Approaches Bashi Channel, Halting Key Taiwan-Bound Air & Sea Freights", source: "Financial Times", timestamp: "2026-09-11T14:10:00Z", related_chokepoints: ["chk_003"], severity: "MEDIUM", sentiment: -0.45 },
  { id: "news_127", title: "Rhine River Low Water Surges Barge Surcharges by 40% Across European Chemical Hubs", source: "Argus Media", timestamp: "2026-09-11T11:05:00Z", related_chokepoints: ["chk_006"], severity: "MEDIUM", sentiment: -0.40 },
];

export const MOCK_SIGNALS: ConsoleSignal[] = [
  { id: "sig_099", type: "WEATHER", severity: "HIGH", description: "Category 4 Typhoon Yagi entering Northern Philippines / Luzon Strait", precision_score: 0.95, timestamp: "2026-09-11T18:00:00Z" },
  { id: "sig_100", type: "PORT_CONGESTION", severity: "HIGH", description: "Anchorage dwell time in Singapore Strait exceeds 74 hours for container vessels", precision_score: 0.91, timestamp: "2026-09-11T17:30:00Z" },
  { id: "sig_101", type: "MARITIME_SECURITY", severity: "CRITICAL", description: "UKMTO Advisory 042: Unmanned surface vessel incident reported near Bab-el-Mandeb", precision_score: 0.88, timestamp: "2026-09-11T16:20:00Z" },
  { id: "sig_102", type: "CUSTOMS_LOGISTICS", severity: "MEDIUM", description: "Automated clearance system outage at Port of Rotterdam Maasvlakte II terminal", precision_score: 0.82, timestamp: "2026-09-11T13:45:00Z" },
  { id: "sig_103", type: "LABOR_UNION", severity: "HIGH", description: "45,000 ILA dockworkers issue strike deadline for Atlantic & Gulf Coast ports", precision_score: 0.94, timestamp: "2026-09-11T12:00:00Z" },
];

export const MOCK_STRESS_FORECAST: ConsoleStressForecast = {
  current_score: 0.65,
  highest_30d_forecast: 0.88,
  peak_date: "2026-09-25",
  disruption_probability: 0.72,
  daily_trend: [
    { day: 1, date: "2026-09-12", predicted_stress: 0.65, p50: 0.65, p90: 0.71 },
    { day: 3, date: "2026-09-14", predicted_stress: 0.68, p50: 0.68, p90: 0.75 },
    { day: 7, date: "2026-09-18", predicted_stress: 0.76, p50: 0.76, p90: 0.84 },
    { day: 11, date: "2026-09-22", predicted_stress: 0.84, p50: 0.84, p90: 0.92 },
    { day: 14, date: "2026-09-25", predicted_stress: 0.88, p50: 0.88, p90: 0.96 },
    { day: 18, date: "2026-09-29", predicted_stress: 0.83, p50: 0.83, p90: 0.91 },
    { day: 22, date: "2026-10-03", predicted_stress: 0.75, p50: 0.75, p90: 0.83 },
    { day: 26, date: "2026-10-07", predicted_stress: 0.69, p50: 0.69, p90: 0.76 },
    { day: 30, date: "2026-10-11", predicted_stress: 0.64, p50: 0.64, p90: 0.72 },
  ],
};

export const MOCK_SUPPLY_CHAINS: ConsoleSupplyChain[] = [
  {
    id: "sc_001",
    name: "Semiconductor Route Alpha (East Asia → NA)",
    chokepoints: ["chk_012", "chk_015", "chk_001"],
    travel_time_days: 45,
    revised_arrival_date: "2026-10-15",
    stress: 0.77,
    criticality: "HIGH",
    disruption_probability: 0.65,
    origin: "Hsinchu / Taipei Hub",
    destination: "Austin, TX Fab Complex",
    bom_trace: [
      { part_id: "P-101", name: "3nm Microcontroller Wafer", supplier: "TSMC Fab 14", tier: 1, lead_time_days: 60, buffer_stock_days: 14, risk_status: "VULNERABLE" },
      { part_id: "P-204", name: "EUV Photoresist Polymer", supplier: "Shin-Etsu Chemical", tier: 2, lead_time_days: 35, buffer_stock_days: 8, risk_status: "CRITICAL" },
      { part_id: "P-309", name: "Ultra-Pure Hydrogen Fluoride", supplier: "Stella Chemifa", tier: 2, lead_time_days: 40, buffer_stock_days: 10, risk_status: "WARNING" },
    ],
  },
  {
    id: "sc_002",
    name: "Automotive Power Electronics (Europe → US Midwest)",
    chokepoints: ["chk_006", "chk_001"],
    travel_time_days: 32,
    revised_arrival_date: "2026-10-04",
    stress: 0.68,
    criticality: "HIGH",
    disruption_probability: 0.58,
    origin: "Stuttgart, DE",
    destination: "Detroit, MI Assembly Hub",
    bom_trace: [
      { part_id: "P-401", name: "SiC Inverter Module", supplier: "Bosch Mobility Solutions", tier: 1, lead_time_days: 45, buffer_stock_days: 20, risk_status: "MONITORED" },
      { part_id: "P-405", name: "IGBT Gate Driver Substrate", supplier: "Infineon Villach", tier: 2, lead_time_days: 50, buffer_stock_days: 12, risk_status: "VULNERABLE" },
    ],
  },
  {
    id: "sc_003",
    name: "Critical Minerals & Battery Cathodes (APAC → EU)",
    chokepoints: ["chk_007", "chk_002"],
    travel_time_days: 52,
    revised_arrival_date: "2026-10-28",
    stress: 0.89,
    criticality: "CRITICAL",
    disruption_probability: 0.84,
    origin: "Ningbo / Busan Maritime Hub",
    destination: "Rotterdam Gateway → Berlin Gigafactory",
    bom_trace: [
      { part_id: "P-501", name: "LFP Prismatic Battery Cells", supplier: "CATL Yibin Facility", tier: 1, lead_time_days: 55, buffer_stock_days: 9, risk_status: "DISRUPTED" },
      { part_id: "P-502", name: "Synthetic Anode Spherical Graphite", supplier: "BTR New Material", tier: 2, lead_time_days: 40, buffer_stock_days: 15, risk_status: "VULNERABLE" },
    ],
  },
  {
    id: "sc_004",
    name: "Aerospace Carbon Composites (Japan → US West Coast)",
    chokepoints: ["chk_003"],
    travel_time_days: 28,
    revised_arrival_date: "2026-09-30",
    stress: 0.44,
    criticality: "MEDIUM",
    disruption_probability: 0.35,
    origin: "Nagoya, JP",
    destination: "Seattle, WA Aerospace Facility",
    bom_trace: [
      { part_id: "P-601", name: "Torayca Carbon Fiber Prepreg", supplier: "Toray Industries", tier: 1, lead_time_days: 30, buffer_stock_days: 25, risk_status: "NORMAL" },
    ],
  },
];

export const MOCK_CONSOLE_ALERTS: ConsoleAlert[] = [
  {
    id: "alt_001",
    severity: "CRITICAL",
    message: "Potential stock-out in 14 days due to Red Sea & Bab-el-Mandeb maritime rerouting.",
    related_chokepoint: "Bab-el-Mandeb (chk_007)",
    confidence: 0.94,
    mitigations: [
      { type: "ALTERNATE_SOURCING", recommendation: "Switch secondary wafer substrate sourcing to European fab partner (Munich)", cost_impact: "+15%", lead_time_reduction_days: 18 },
      { type: "EXPEDITING", recommendation: "Charter dedicated priority Air Freight for critical Tier-2 photoresist lots", cost_impact: "+35%", lead_time_reduction_days: 22 },
      { type: "INVENTORY_REALLOCATION", recommendation: "Draw safety buffer stock from Memphis central distribution hub", cost_impact: "+4%", lead_time_reduction_days: 12 },
    ],
  },
  {
    id: "alt_002",
    severity: "HIGH",
    message: "Panama Canal draft restrictions delaying US East Coast container arrivals by 9-14 days.",
    related_chokepoint: "Panama Canal (chk_001)",
    confidence: 0.89,
    mitigations: [
      { type: "INTERMODAL_TRANSFER", recommendation: "Reroute containers via Long Beach marine terminal to BNSF Transcontinental rail", cost_impact: "+12%", lead_time_reduction_days: 8 },
      { type: "INVENTORY_HOLD", recommendation: "Extend client fulfillment window for non-priority SKU tranches", cost_impact: "0%", lead_time_reduction_days: 5 },
    ],
  },
  {
    id: "alt_003",
    severity: "MEDIUM",
    message: "Port strike authorization on US Atlantic coast threatens 48h terminal embargo.",
    related_chokepoint: "Port of NY/NJ (chk_045)",
    confidence: 0.78,
    mitigations: [
      { type: "ADVANCE_DISPATCH", recommendation: "Accelerate outbound gate pick-ups and off-dock staging prior to strike window", cost_impact: "+3%", lead_time_reduction_days: 6 },
    ],
  },
];

export const MOCK_SIMULATE_RESPONSE: StressTestSimulateRes = {
  simulation_id: "sim_999",
  target_type: "PORT",
  target_id: "port_la",
  target_name: "Port of Los Angeles",
  time_to_stock_out_days: 18,
  cascading_effects: [
    "Depletion of West Coast Inventory Hub A by Day 12",
    "Sub-assembly line starvation at Texas Facility by Day 15",
    "Production halt at Factory C by Day 18",
    "Estimated revenue disruption: $4.2M / day post Day 18",
  ],
};
