import { NextRequest, NextResponse } from 'next/server';

/**
 * Catch-all proxy for /ui/* routes.
 *
 * brain_mode.html fetches from /ui/cascade/map, /ui/flights, /ui/vessels, etc.
 * This route proxies those requests to the Paqshi backend (if available)
 * or returns mock data so the globe renders without a backend.
 *
 * Set PAQSHI_BACKEND_URL env var to point to a running Paqshi backend.
 * Defaults to http://localhost:4000.
 */

const PAQSHI_BACKEND = process.env.PAQSHI_BACKEND_URL || 'http://localhost:4000';

// ── Mock data for when Paqshi backend is offline ─────────────────────────────

const MOCK_CASCADE = {
  chokepoints: [
    { id: 'suez-canal', name: 'Suez Canal', category: 'maritime', latitude: 30.58, longitude: 32.34, stress_level: 0.72, baseline: 0.15, criticality: 0.95 },
    { id: 'strait-hormuz', name: 'Strait of Hormuz', category: 'maritime', latitude: 26.57, longitude: 56.25, stress_level: 0.58, baseline: 0.12, criticality: 0.90 },
    { id: 'strait-malacca', name: 'Strait of Malacca', category: 'maritime', latitude: 2.50, longitude: 101.50, stress_level: 0.45, baseline: 0.10, criticality: 0.88 },
    { id: 'panama-canal', name: 'Panama Canal', category: 'maritime', latitude: 9.10, longitude: -79.70, stress_level: 0.38, baseline: 0.08, criticality: 0.85 },
    { id: 'port-singapore', name: 'Port of Singapore', category: 'port', latitude: 1.26, longitude: 103.84, stress_level: 0.65, baseline: 0.10, criticality: 0.92 },
    { id: 'port-shanghai', name: 'Port of Shanghai', category: 'port', latitude: 31.23, longitude: 121.47, stress_level: 0.52, baseline: 0.12, criticality: 0.88 },
    { id: 'port-rotterdam', name: 'Port of Rotterdam', category: 'port', latitude: 51.92, longitude: 4.48, stress_level: 0.30, baseline: 0.06, criticality: 0.80 },
    { id: 'port-los-angeles', name: 'Port of Los Angeles', category: 'port', latitude: 33.74, longitude: -118.26, stress_level: 0.42, baseline: 0.08, criticality: 0.82 },
    { id: 'cape-good-hope', name: 'Cape of Good Hope', category: 'maritime', latitude: -34.35, longitude: 18.47, stress_level: 0.22, baseline: 0.05, criticality: 0.70 },
    { id: 'bab-el-mandeb', name: 'Bab el-Mandeb', category: 'maritime', latitude: 12.58, longitude: 43.33, stress_level: 0.68, baseline: 0.14, criticality: 0.91 },
  ],
  events: [
    { id: 'evt-001', latitude: 30.58, longitude: 32.34, domain: 'geopolitics', severity: 0.8, event_category: 'conflict', occurred_at: '2026-09-10T14:00:00Z', raw_text: 'Escalation in Red Sea region affecting shipping lanes', title: 'Red Sea Shipping Disruption', actor: 'Houthi forces', object: 'Commercial vessels', location: 'Red Sea', source_ids: ['reuters-001'] },
    { id: 'evt-002', latitude: 26.57, longitude: 56.25, domain: 'geopolitics', severity: 0.65, event_category: 'tension', occurred_at: '2026-09-10T10:00:00Z', raw_text: 'Iranian naval activity near Strait of Hormuz', title: 'Hormuz Tensions', actor: 'Iran', object: 'Naval patrol', location: 'Persian Gulf', source_ids: ['bbc-001'] },
    { id: 'evt-003', latitude: 1.26, longitude: 103.84, domain: 'corporate', severity: 0.55, event_category: 'port_congestion', occurred_at: '2026-09-09T22:00:00Z', raw_text: 'Singapore port congestion reaching critical levels with 3-5 day delays', title: 'Singapore Congestion', actor: 'PSA International', object: 'Port operations', location: 'Singapore', source_ids: ['freightwaves-001'] },
    { id: 'evt-004', latitude: 31.23, longitude: 121.47, domain: 'climate', severity: 0.70, event_category: 'weather', occurred_at: '2026-09-10T06:00:00Z', raw_text: 'Tropical Storm Bolaven approaching East China Sea', title: 'Tropical Storm Bolaven', actor: 'Nature', object: 'Shipping routes', location: 'East China Sea', source_ids: ['jma-001'] },
    { id: 'evt-005', latitude: 9.10, longitude: -79.70, domain: 'corporate', severity: 0.40, event_category: 'operational', occurred_at: '2026-09-09T18:00:00Z', raw_text: 'Panama Canal water levels improving, transit slots increasing', title: 'Panama Canal Recovery', actor: 'ACP', object: 'Canal operations', location: 'Panama', source_ids: ['gcaptain-001'] },
    { id: 'evt-006', latitude: 33.74, longitude: -118.26, domain: 'corporate', severity: 0.48, event_category: 'labor', occurred_at: '2026-09-10T08:00:00Z', raw_text: 'West Coast port labor negotiations continue, potential slowdown', title: 'West Coast Labor Talks', actor: 'ILWU', object: 'Port operations', location: 'Los Angeles', source_ids: ['loadstar-001'] },
    { id: 'evt-007', latitude: 12.58, longitude: 43.33, domain: 'geopolitics', severity: 0.75, event_category: 'conflict', occurred_at: '2026-09-10T12:00:00Z', raw_text: 'Continued instability near Bab el-Mandeb strait', title: 'Bab el-Mandeb Risk', actor: 'Multiple actors', object: 'Shipping lane', location: 'Yemen', source_ids: ['lloyds-001'] },
    { id: 'evt-008', latitude: 51.92, longitude: 4.48, domain: 'technology', severity: 0.35, event_category: 'cyber', occurred_at: '2026-09-09T14:00:00Z', raw_text: 'Minor cyber incident at European port terminal, operations unaffected', title: 'Rotterdam Cyber Alert', actor: 'Unknown', object: 'Port IT systems', location: 'Netherlands', source_ids: ['ncsc-001'] },
  ],
  impact_edges: [
    { from_chokepoint: 'suez-canal', to_entity_id: 'europe-bound-ships', to_entity_name: 'Europe-bound container ships', severity: 0.72 },
    { from_chokepoint: 'suez-canal', to_entity_id: 'asia-europe-trade', to_entity_name: 'Asia-Europe trade route', severity: 0.68 },
    { from_chokepoint: 'bab-el-mandeb', to_entity_id: 'red-sea-shipping', to_entity_name: 'Red Sea shipping corridor', severity: 0.65 },
    { from_chokepoint: 'strait-hormuz', to_entity_id: 'oil-tankers', to_entity_name: 'Persian Gulf oil tankers', severity: 0.58 },
    { from_chokepoint: 'strait-malacca', to_entity_id: 'china-imports', to_entity_name: 'China energy imports', severity: 0.45 },
    { from_chokepoint: 'port-singapore', to_entity_id: 'asean-transshipment', to_entity_name: 'ASEAN transshipment hub', severity: 0.60 },
    { from_chokepoint: 'port-shanghai', to_entity_id: 'china-exports', to_entity_name: 'China manufacturing exports', severity: 0.52 },
  ],
};

const MOCK_FLIGHTS = {
  flights: [
    { icao: 'A0B1C2', callsign: 'UAL123', lat: 45.3, lon: -30.2, alt_m: 10668, vel_ms: 250, heading: 65, mil: false, country: 'US', on_ground: false },
    { icao: 'D3E4F5', callsign: 'BAW456', lat: 51.5, lon: -10.3, alt_m: 11278, vel_ms: 230, heading: 120, mil: false, country: 'GB', on_ground: false },
    { icao: 'G7H8I9', callsign: 'AFR789', lat: 46.2, lon: 2.1, alt_m: 10058, vel_ms: 245, heading: 180, mil: false, country: 'FR', on_ground: false },
    { icao: 'J1K2L3', callsign: 'SQC321', lat: 1.3, lon: 103.8, alt_m: 0, vel_ms: 0, heading: 270, mil: false, country: 'SG', on_ground: true },
    { icao: 'M4N5O6', callsign: 'CCA654', lat: 31.2, lon: 121.5, alt_m: 9144, vel_ms: 220, heading: 300, mil: false, country: 'CN', on_ground: false },
    { icao: 'P7Q8R9', callsign: 'RCH111', lat: 25.0, lon: -55.0, alt_m: 12192, vel_ms: 260, heading: 45, mil: true, country: 'US', on_ground: false },
  ],
  stale: false,
};

const MOCK_VESSELS = {
  vessels: [
    { mmsi: '311000123', name: 'MSC Diana', callsign: 'D9GF7', imo: '9641735', lat: 30.6, lon: 32.4, speed: 12.5, heading: 180, bucket: 'cargo', destination: 'Singapore', flag: 'PA' },
    { mmsi: '636019234', name: 'Maersk Seletar', callsign: 'D5DF9', imo: '9702353', lat: 1.3, lon: 103.9, speed: 0.2, heading: 90, bucket: 'cargo', destination: 'Rotterdam', flag: 'HK' },
    { mmsi: '538006789', name: 'Frontline Voyager', callsign: 'V7MD2', imo: '9403215', lat: 26.6, lon: 56.3, speed: 14.8, heading: 120, bucket: 'tanker', destination: 'Ras Laffan', flag: 'MH' },
    { mmsi: '219014567', name: 'Stena Germanica', callsign: 'OXKZ2', imo: '9312345', lat: 57.4, lon: 11.9, speed: 16.2, heading: 330, bucket: 'passenger', destination: 'Kiel', flag: 'SE' },
    { mmsi: '477012345', name: 'Pacific Explorer', callsign: 'VRLK8', imo: '9512345', lat: -33.8, lon: 18.5, speed: 8.5, heading: 45, bucket: 'fishing', destination: 'Cape Town', flag: 'HK' },
    { mmsi: '244820987', name: 'HNLMS De Ruyter', callsign: 'PBH2', imo: 0, lat: 51.9, lon: 4.5, speed: 5.0, heading: 270, bucket: 'military', destination: 'Den Helder', flag: 'NL' },
  ],
  connected: true,
};

// ── Mock detail responses ────────────────────────────────────────────────────

function mockChokepointDetail(id: string) {
  const cp = MOCK_CASCADE.chokepoints.find(c => c.id === id) || MOCK_CASCADE.chokepoints[0];
  const history = [];
  for (let i = 14; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    history.push({ t: d.toISOString(), level: cp.stress_level + (Math.random() - 0.5) * 0.1 });
  }
  return {
    item: { history },
    latest_forecast: {
      predicate: `Disruption probability at ${cp.name}`,
      p: cp.stress_level,
      horizon_end: new Date(Date.now() + 14 * 86400000).toISOString(),
      provenance: { falsification_trigger: 'Stress level drops below baseline for 7 consecutive days' },
    },
    resolved_dependents: [
      { name: 'Container shipping' },
      { name: 'Oil transit' },
      { name: 'Consumer goods supply' },
    ],
  };
}

function mockEventsRecent() {
  return { items: MOCK_CASCADE.events };
}

function mockWatchesAlerts() {
  return {
    items: [
      { title: 'Red Sea corridor elevated risk', delta: 2.3, watch_id: 'w-001', watch: { subjects: [{ canonical_id: 'suez-canal', name: 'Suez Canal' }, { canonical_id: 'bab-el-mandeb', name: 'Bab el-Mandeb' }] } },
      { title: 'Singapore congestion watch', delta: 1.8, watch_id: 'w-002', watch: { subjects: [{ canonical_id: 'port-singapore', name: 'Port of Singapore' }] } },
      { title: 'Strait of Hormuz tension monitor', delta: 1.5, watch_id: 'w-003', watch: { subjects: [{ canonical_id: 'strait-hormuz', name: 'Strait of Hormuz' }] } },
    ],
  };
}

function mockBriefLatest() {
  return {
    executive: 'Global supply chain stress remains elevated due to Red Sea disruptions and Singapore port congestion.',
    risks: [
      { title: 'Red Sea shipping corridor', severity: 0.85, why: 'Continued attacks on commercial vessels' },
      { title: 'Singapore port delays', severity: 0.65, why: 'Terminal congestion with 3-5 day wait times' },
      { title: 'Strait of Hormuz tensions', severity: 0.55, why: 'Regional naval activity increasing' },
    ],
    watchlist: [
      { title: 'Panama Canal recovery', status: 'active', why: 'Water levels improving, transit slots increasing' },
      { title: 'West Coast labor talks', status: 'active', why: 'Negotiations ongoing, no slowdown yet' },
    ],
  };
}

function mockVesselTracks() {
  return {
    tracks: MOCK_VESSELS.vessels.filter(v => v.speed > 2).map(v => ({
      bucket: v.bucket,
      points: Array.from({ length: 20 }, (_, i) => ({
        lat: v.lat + (Math.random() - 0.5) * 2,
        lon: v.lon + (Math.random() - 0.5) * 4,
      })),
    })),
  };
}

function mockCountrySnapshot(iso: string) {
  return {
    events: MOCK_CASCADE.events.slice(0, 4),
    graph_nodes: [],
    chokepoints: MOCK_CASCADE.chokepoints.slice(0, 3),
    vessels: MOCK_VESSELS.vessels.slice(0, 2).map(v => ({ bucket: v.bucket })),
    aircraft: MOCK_FLIGHTS.flights.slice(0, 2).map(f => ({ callsign: f.callsign, icao: f.icao, is_mil: f.mil })),
    watch_alerts: [],
  };
}

function mockCluster() {
  return {
    n_events_total: MOCK_CASCADE.events.length,
    clusters: [
      { domain: 'geopolitics', category: 'conflict', label: 'Red Sea disruption', summary: 'Multiple incidents affecting shipping', n_events: 3, severity_mean: 0.72 },
      { domain: 'corporate', category: 'port_congestion', label: 'Singapore congestion', summary: 'Terminal delays increasing', n_events: 2, severity_mean: 0.55 },
    ],
  };
}

function mockFpvTrack() {
  return { positions: [{ lat: 30.6, lon: 32.4, ts: null }, { lat: 31.0, lon: 33.0, ts: null }] };
}

// ── Proxy handler ────────────────────────────────────────────────────────────

async function proxyToPaqshi(path: string, url: string): Promise<NextResponse | null> {
  try {
    const targetUrl = `${PAQSHI_BACKEND}${path}${url.search}`;
    const res = await fetch(targetUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Paqshi backend not available, fall through to mock
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const path = '/' + (slug?.join('/') || '');
  const url = new URL(request.url);

  // Try Paqshi backend first
  const proxied = await proxyToPaqshi(`/ui${path}`, url);
  if (proxied) return proxied;

  // Fall back to mock data
  if (path === '/cascade/map') {
    return NextResponse.json(MOCK_CASCADE);
  }
  if (path === '/flights') {
    return NextResponse.json(MOCK_FLIGHTS);
  }
  if (path === '/vessels' && !url.searchParams.has('min_points')) {
    return NextResponse.json(MOCK_VESSELS);
  }
  if (path === '/vessels/tracks') {
    return NextResponse.json(mockVesselTracks());
  }
  if (path.startsWith('/chokepoints/')) {
    const id = decodeURIComponent(path.split('/chokepoints/')[1]?.split('?')[0] || '');
    return NextResponse.json(mockChokepointDetail(id));
  }
  if (path === '/events/recent') {
    return NextResponse.json(mockEventsRecent());
  }
  if (path === '/watches/alerts/active') {
    return NextResponse.json(mockWatchesAlerts());
  }
  if (path === '/brief/latest') {
    return NextResponse.json(mockBriefLatest());
  }
  if (path === '/country/at') {
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lon = parseFloat(url.searchParams.get('lon') || '0');
    // Simple bounding box country detection
    if (lat > 25 && lat < 42 && lon > 25 && lon < 45) return NextResponse.json({ country: { name: 'Egypt', iso_a3: 'EGY', iso_a2: 'EG' } });
    if (lat > -5 && lat < 8 && lon > 95 && lon < 120) return NextResponse.json({ country: { name: 'Indonesia', iso_a3: 'IDN', iso_a2: 'ID' } });
    if (lat > 0 && lat < 3 && lon > 100 && lon < 105) return NextResponse.json({ country: { name: 'Singapore', iso_a3: 'SGP', iso_a2: 'SG' } });
    return NextResponse.json({ country: null });
  }
  if (path.startsWith('/country/') && path.endsWith('/snapshot')) {
    const iso = path.split('/country/')[1]?.split('/')[0] || '';
    return NextResponse.json(mockCountrySnapshot(iso));
  }
  if (path === '/cluster') {
    return NextResponse.json(mockCluster());
  }
  if (path.startsWith('/fpv/track/')) {
    return NextResponse.json(mockFpvTrack());
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
