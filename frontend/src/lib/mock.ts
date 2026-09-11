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
  { id: "al-1", title: "Suez Canal Blockage", signal_type: "geopolitical", severity: "critical", location: "Egypt", entities_affected: 15, expected_delay_days: 12, confidence: 0.85, summary: "Major blockage in Suez.", impact_radius_km: 500, created_at: new Date().toISOString() }
];

export const MOCK_SHIPPING: GeoFeatureCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: { type: "LineString", coordinates: [[32.2659, 30.5852], [100.13, 4.1147]] }, properties: { name: "Asia-Europe", stress: 0.7 } }
  ]
};
