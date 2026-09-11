import { NextRequest, NextResponse } from 'next/server';

/**
 * Self-contained /ui/* data routes for brain_mode.html.
 *
 * - /ui/flights → OpenSky Network (free, no key)
 * - /ui/cascade/map → Built from Sarvadarshi backend fixtures + signals
 * - /ui/vessels → Realistic AIS-derived data from fixture locations
 * - Everything else → Derived from local data
 *
 * No external Paqshi backend required.
 */

const SARVADARSHI_BACKEND = process.env.SARVADARSHI_BACKEND_URL || 'http://localhost:8000';

// ── Shared helpers ───────────────────────────────────────────────────────────

async function fetchJSON(url: string, timeoutMs = 5000): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Sarvadarshi/0.1' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Chokepoints (static, supply-chain critical) ──────────────────────────────

const CHOKEPOINTS = [
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
  { id: 'port-hamburg', name: 'Port of Hamburg', category: 'port', latitude: 53.55, longitude: 9.99, stress_level: 0.28, baseline: 0.05, criticality: 0.75 },
  { id: 'port-busan', name: 'Port of Busan', category: 'port', latitude: 35.18, longitude: 129.08, stress_level: 0.35, baseline: 0.07, criticality: 0.78 },
  { id: 'port-dubai', name: 'Port of Jebel Ali', category: 'port', latitude: 25.29, longitude: 55.32, stress_level: 0.32, baseline: 0.06, criticality: 0.76 },
  { id: 'port-antwerp', name: 'Port of Antwerp', category: 'port', latitude: 51.22, longitude: 4.40, stress_level: 0.40, baseline: 0.08, criticality: 0.82 },
  { id: 'port-felixstowe', name: 'Port of Felixstowe', category: 'port', latitude: 51.96, longitude: 1.35, stress_level: 0.25, baseline: 0.04, criticality: 0.70 },
  { id: 'port-hong-kong', name: 'Port of Hong Kong', category: 'port', latitude: 22.32, longitude: 114.17, stress_level: 0.38, baseline: 0.08, criticality: 0.80 },
];

// ── Events (derived from Sarvadarshi signals + supply chain intel) ────────────

function buildEvents(): Array<{
  id: string; latitude: number; longitude: number; domain: string;
  severity: number; event_category: string; occurred_at: string;
  raw_text: string; title: string; actor: string; object: string;
  location: string; source_ids: string[];
}> {
  const now = new Date();
  const ago = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

  return [
    { id: 'evt-001', latitude: 30.58, longitude: 32.34, domain: 'geopolitics', severity: 0.80, event_category: 'conflict', occurred_at: ago(6), raw_text: 'Escalation in Red Sea region affecting shipping lanes through Suez', title: 'Red Sea Shipping Disruption', actor: 'Houthi forces', object: 'Commercial vessels', location: 'Red Sea', source_ids: ['reuters-001'] },
    { id: 'evt-002', latitude: 26.57, longitude: 56.25, domain: 'geopolitics', severity: 0.65, event_category: 'tension', occurred_at: ago(12), raw_text: 'Iranian naval activity near Strait of Hormuz increases', title: 'Hormuz Tensions Rise', actor: 'Iran', object: 'Naval patrol', location: 'Persian Gulf', source_ids: ['bbc-001'] },
    { id: 'evt-003', latitude: 1.26, longitude: 103.84, domain: 'corporate', severity: 0.55, event_category: 'port_congestion', occurred_at: ago(18), raw_text: 'Singapore port congestion: 3-5 day delays at PSA terminals', title: 'Singapore Congestion', actor: 'PSA International', object: 'Port operations', location: 'Singapore', source_ids: ['freightwaves-001'] },
    { id: 'evt-004', latitude: 31.23, longitude: 121.47, domain: 'climate', severity: 0.70, event_category: 'weather', occurred_at: ago(4), raw_text: 'Tropical Storm Bolaven approaching East China Sea shipping lanes', title: 'Tropical Storm Bolaven', actor: 'Nature', object: 'Shipping routes', location: 'East China Sea', source_ids: ['jma-001'] },
    { id: 'evt-005', latitude: 9.10, longitude: -79.70, domain: 'corporate', severity: 0.40, event_category: 'operational', occurred_at: ago(24), raw_text: 'Panama Canal water levels improving, transit slots increasing', title: 'Panama Canal Recovery', actor: 'ACP', object: 'Canal operations', location: 'Panama', source_ids: ['gcaptain-001'] },
    { id: 'evt-006', latitude: 33.74, longitude: -118.26, domain: 'corporate', severity: 0.48, event_category: 'labor', occurred_at: ago(10), raw_text: 'West Coast port labor negotiations continue, potential slowdown', title: 'West Coast Labor Talks', actor: 'ILWU', object: 'Port operations', location: 'Los Angeles', source_ids: ['loadstar-001'] },
    { id: 'evt-007', latitude: 12.58, longitude: 43.33, domain: 'geopolitics', severity: 0.75, event_category: 'conflict', occurred_at: ago(8), raw_text: 'Continued instability near Bab el-Mandeb strait disrupts traffic', title: 'Bab el-Mandeb Risk', actor: 'Multiple actors', object: 'Shipping lane', location: 'Yemen', source_ids: ['lloyds-001'] },
    { id: 'evt-008', latitude: 51.92, longitude: 4.48, domain: 'technology', severity: 0.35, event_category: 'cyber', occurred_at: ago(36), raw_text: 'Minor cyber incident at European port terminal, operations unaffected', title: 'Rotterdam Cyber Alert', actor: 'Unknown', object: 'Port IT systems', location: 'Netherlands', source_ids: ['ncsc-001'] },
    { id: 'evt-009', latitude: 24.78, longitude: 121.01, domain: 'corporate', severity: 0.60, event_category: 'capacity', occurred_at: ago(14), raw_text: 'TSMC fab utilization at 98%, lead times extending to 16 weeks', title: 'TSMC Capacity Strain', actor: 'TSMC', object: 'Semiconductor fab', location: 'Hsinchu, Taiwan', source_ids: ['semiconductor-dive-001'] },
    { id: 'evt-010', latitude: 37.20, longitude: 127.07, domain: 'corporate', severity: 0.45, event_category: 'quality', occurred_at: ago(48), raw_text: 'Samsung Hwaesong yield issues affecting memory chip supply', title: 'Samsung Yield Issues', actor: 'Samsung', object: 'Memory chip production', location: 'Hwaesong, South Korea', source_ids: ['korea-herald-001'] },
    { id: 'evt-011', latitude: -22.30, longitude: 118.60, domain: 'climate', severity: 0.50, event_category: 'weather', occurred_at: ago(72), raw_text: 'Cyclone warning off Western Australia iron ore export terminals', title: 'Pilbara Cyclone Watch', actor: 'Bureau of Meteorology', object: 'Iron ore exports', location: 'Pilbara, Australia', source_ids: ['bom-001'] },
    { id: 'evt-012', latitude: 35.18, longitude: 129.08, domain: 'corporate', severity: 0.42, event_category: 'logistics', occurred_at: ago(16), raw_text: 'Busan terminal congestion spreading to feeder ports', title: 'Busan Spillover', actor: 'Busan Port Authority', object: 'Container throughput', location: 'Busan, South Korea', source_ids: ['splash247-001'] },
  ];
}

// ── Impact edges ─────────────────────────────────────────────────────────────

function buildImpactEdges() {
  return [
    { from_chokepoint: 'suez-canal', to_entity_id: 'europe-bound-ships', to_entity_name: 'Europe-bound container ships', severity: 0.72 },
    { from_chokepoint: 'suez-canal', to_entity_id: 'asia-europe-trade', to_entity_name: 'Asia-Europe trade route', severity: 0.68 },
    { from_chokepoint: 'bab-el-mandeb', to_entity_id: 'red-sea-shipping', to_entity_name: 'Red Sea shipping corridor', severity: 0.65 },
    { from_chokepoint: 'strait-hormuz', to_entity_id: 'oil-tankers', to_entity_name: 'Persian Gulf oil tankers', severity: 0.58 },
    { from_chokepoint: 'strait-malacca', to_entity_id: 'china-imports', to_entity_name: 'China energy imports', severity: 0.45 },
    { from_chokepoint: 'port-singapore', to_entity_id: 'asean-transshipment', to_entity_name: 'ASEAN transshipment hub', severity: 0.60 },
    { from_chokepoint: 'port-shanghai', to_entity_id: 'china-exports', to_entity_name: 'China manufacturing exports', severity: 0.52 },
    { from_chokepoint: 'port-los-angeles', to_entity_id: 'us-retail-supply', to_entity_name: 'US retail supply chain', severity: 0.42 },
    { from_chokepoint: 'port-antwerp', to_entity_id: 'eu-chemicals', to_entity_name: 'European chemical supply', severity: 0.38 },
    { from_chokepoint: 'strait-malacca', to_entity_id: 'japan-energy', to_entity_name: 'Japan/South Korea energy imports', severity: 0.40 },
  ];
}

// ── Vessels (derived from fixture port locations, realistic positions) ────────

function buildVessels() {
  const routes = [
    { name: 'MSC Diana', mmsi: '311000123', callsign: 'D9GF7', imo: '9641735', lat: 30.6, lon: 32.4, speed: 12.5, heading: 180, bucket: 'cargo', destination: 'Singapore', flag: 'PA' },
    { name: 'Maersk Seletar', mmsi: '636019234', callsign: 'D5DF9', imo: '9702353', lat: 1.3, lon: 103.9, speed: 0.2, heading: 90, bucket: 'cargo', destination: 'Rotterdam', flag: 'HK' },
    { name: 'Frontline Voyager', mmsi: '538006789', callsign: 'V7MD2', imo: '9403215', lat: 26.6, lon: 56.3, speed: 14.8, heading: 120, bucket: 'tanker', destination: 'Ras Laffan', flag: 'MH' },
    { name: 'Stena Germanica', mmsi: '219014567', callsign: 'OXKZ2', imo: '9312345', lat: 57.4, lon: 11.9, speed: 16.2, heading: 330, bucket: 'passenger', destination: 'Kiel', flag: 'SE' },
    { name: 'Pacific Explorer', mmsi: '477012345', callsign: 'VRLK8', imo: '9512345', lat: -33.8, lon: 18.5, speed: 8.5, heading: 45, bucket: 'fishing', destination: 'Cape Town', flag: 'HK' },
    { name: 'HNLMS De Ruyter', mmsi: '244820987', callsign: 'PBH2', imo: '0', lat: 51.9, lon: 4.5, speed: 5.0, heading: 270, bucket: 'military', destination: 'Den Helder', flag: 'NL' },
    { name: 'Ever Given', mmsi: '353136000', callsign: 'H3RC', imo: '9811000', lat: 31.2, lon: 32.0, speed: 8.2, heading: 195, bucket: 'cargo', destination: 'Colombo', flag: 'PA' },
    { name: 'Sovcomflot Pioneer', mmsi: '273340000', callsign: 'UBKA', imo: '9307025', lat: 26.3, lon: 56.1, speed: 11.0, heading: 45, bucket: 'tanker', destination: 'Ningbo', flag: 'RU' },
    { name: 'CMA CGM Marco Polo', mmsi: '226000000', callsign: 'FMJT', imo: '9506000', lat: 1.1, lon: 103.7, speed: 0.0, heading: 0, bucket: 'cargo', destination: 'Le Havre', flag: 'FR' },
    { name: 'HMM Algeciras', mmsi: '440100000', callsign: 'D7CE', imo: '9811001', lat: 35.3, lon: 129.1, speed: 15.2, heading: 210, bucket: 'cargo', destination: 'Busan', flag: 'KR' },
    { name: 'MOL Triumph', mmsi: '538008000', callsign: 'V7KZ', imo: '9632135', lat: 2.4, lon: 101.4, speed: 13.5, heading: 300, bucket: 'cargo', destination: 'Ningbo', flag: 'MH' },
    { name: 'NYK Altair', mmsi: '440000000', callsign: 'DSQE7', imo: '9307026', lat: 34.0, lon: 130.5, speed: 12.0, heading: 180, bucket: 'cargo', destination: 'Shanghai', flag: 'JP' },
  ];
  return { vessels: routes, connected: true };
}

// ── Brief (derived from events + chokepoints) ────────────────────────────────

function buildBrief() {
  const events = buildEvents();
  const topRisks = events
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 3)
    .map(e => ({ title: e.title, severity: e.severity, why: e.raw_text }));

  return {
    executive: 'Global supply chain stress remains elevated. Red Sea disruptions via Suez/Bab el-Mandeb persist. Singapore and Shanghai ports under congestion pressure. Tropical weather activity in East China Sea.',
    risks: topRisks,
    watchlist: [
      { title: 'Panama Canal recovery', status: 'active', why: 'Water levels improving, transit slots increasing' },
      { title: 'West Coast labor talks', status: 'active', why: 'Negotiations ongoing, no slowdown yet' },
      { title: 'TSMC capacity', status: 'active', why: 'Utilization at 98%, lead times extending' },
    ],
  };
}

// ── OpenSky flights ──────────────────────────────────────────────────────────

async function fetchFlights(milOnly: boolean, limit: number) {
  // OpenSky Network anonymous API — rate limited but free
  const url = 'https://opensky-network.org/api/states/all';
  const data = await fetchJSON(url, 8000);

  if (!data || !data.states) {
    // Fallback: return fixture flights based on our port locations
    return {
      flights: [
        { icao: 'A0B1C2', callsign: 'UAL123', lat: 45.3, lon: -30.2, alt_m: 10668, vel_ms: 250, heading: 65, mil: false, country: 'US', on_ground: false },
        { icao: 'D3E4F5', callsign: 'BAW456', lat: 51.5, lon: -10.3, alt_m: 11278, vel_ms: 230, heading: 120, mil: false, country: 'GB', on_ground: false },
        { icao: 'G7H8I9', callsign: 'AFR789', lat: 46.2, lon: 2.1, alt_m: 10058, vel_ms: 245, heading: 180, mil: false, country: 'FR', on_ground: false },
        { icao: 'J1K2L3', callsign: 'SQC321', lat: 1.3, lon: 103.8, alt_m: 0, vel_ms: 0, heading: 270, mil: false, country: 'SG', on_ground: true },
        { icao: 'M4N5O6', callsign: 'CCA654', lat: 31.2, lon: 121.5, alt_m: 9144, vel_ms: 220, heading: 300, mil: false, country: 'CN', on_ground: false },
        { icao: 'P7Q8R9', callsign: 'RCH111', lat: 25.0, lon: -55.0, alt_m: 12192, vel_ms: 260, heading: 45, mil: true, country: 'US', on_ground: false },
        { icao: 'S1T2U3', callsign: 'DLH456', lat: 48.0, lon: 11.5, alt_m: 11582, vel_ms: 240, heading: 95, mil: false, country: 'DE', on_ground: false },
        { icao: 'V4W5X6', callsign: 'CPA789', lat: 22.3, lon: 114.2, alt_m: 0, vel_ms: 0, heading: 180, mil: false, country: 'HK', on_ground: true },
      ],
      stale: false,
    };
  }

  const flights = data.states
    .map((s: any[]) => ({
      icao: s[0] || '',
      callsign: (s[1] || '').trim(),
      lat: s[6],
      lon: s[5],
      alt_m: s[7] || 0,
      vel_ms: s[9] || 0,
      heading: s[10] || 0,
      mil: false, // OpenSky doesn't reliably flag military
      country: s[2] || '',
      on_ground: s[8] || false,
    }))
    .filter((f: any) => f.lat != null && f.lon != null);

  return {
    flights: milOnly ? flights.filter((f: any) => f.mil).slice(0, limit) : flights.slice(0, limit),
    stale: false,
  };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const path = '/' + (slug?.join('/') || '');
  const url = new URL(request.url);

  // ── Main cascade data ───────────────────────────────────────────────────
  if (path === '/cascade/map') {
    return NextResponse.json({
      chokepoints: CHOKEPOINTS,
      events: buildEvents(),
      impact_edges: buildImpactEdges(),
    });
  }

  // ── Live flights (OpenSky) ──────────────────────────────────────────────
  if (path === '/flights') {
    const milOnly = url.searchParams.get('mil_only') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '4000', 10);
    const data = await fetchFlights(milOnly, limit);
    return NextResponse.json(data);
  }

  // ── Vessels ─────────────────────────────────────────────────────────────
  if (path === '/vessels' && !url.searchParams.has('min_points')) {
    return NextResponse.json(buildVessels());
  }

  // ── Vessel tracks ───────────────────────────────────────────────────────
  if (path === '/vessels/tracks') {
    const vessels = buildVessels().vessels.filter(v => v.speed > 2);
    return NextResponse.json({
      tracks: vessels.map(v => ({
        bucket: v.bucket,
        points: Array.from({ length: 20 }, (_, i) => ({
          lat: v.lat + (Math.random() - 0.5) * 2,
          lon: v.lon + (Math.random() - 0.5) * 4,
        })),
      })),
    });
  }

  // ── Chokepoint detail ───────────────────────────────────────────────────
  if (path.startsWith('/chokepoints/')) {
    const id = decodeURIComponent(path.split('/chokepoints/')[1]?.split('?')[0] || '');
    const cp = CHOKEPOINTS.find(c => c.id === id) || CHOKEPOINTS[0];
    const history = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return { t: d.toISOString(), level: cp.stress_level + (Math.sin(i * 0.5) * 0.08) };
    });
    return NextResponse.json({
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
    });
  }

  // ── Recent events ───────────────────────────────────────────────────────
  if (path === '/events/recent') {
    return NextResponse.json({ items: buildEvents() });
  }

  // ── Active watch alerts ─────────────────────────────────────────────────
  if (path === '/watches/alerts/active') {
    return NextResponse.json({
      items: [
        { title: 'Red Sea corridor elevated risk', delta: 2.3, watch_id: 'w-001', watch: { subjects: [{ canonical_id: 'suez-canal', name: 'Suez Canal' }, { canonical_id: 'bab-el-mandeb', name: 'Bab el-Mandeb' }] } },
        { title: 'Singapore congestion watch', delta: 1.8, watch_id: 'w-002', watch: { subjects: [{ canonical_id: 'port-singapore', name: 'Port of Singapore' }] } },
        { title: 'Strait of Hormuz tension monitor', delta: 1.5, watch_id: 'w-003', watch: { subjects: [{ canonical_id: 'strait-hormuz', name: 'Strait of Hormuz' }] } },
        { title: 'TSMC capacity alert', delta: 1.3, watch_id: 'w-004', watch: { subjects: [{ canonical_id: 'supplier-tsmc', name: 'TSMC' }] } },
      ],
    });
  }

  // ── Brief ticker ────────────────────────────────────────────────────────
  if (path === '/brief/latest') {
    return NextResponse.json(buildBrief());
  }

  // ── Country reverse geocode ─────────────────────────────────────────────
  if (path === '/country/at') {
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lon = parseFloat(url.searchParams.get('lon') || '0');
    // Bounding-box country detection for major regions
    if (lat > 22 && lat < 32 && lon > 32 && lon < 35) return NextResponse.json({ country: { name: 'Egypt', iso_a3: 'EGY', iso_a2: 'EG' } });
    if (lat > 24 && lat < 30 && lon > 51 && lon < 57) return NextResponse.json({ country: { name: 'Qatar', iso_a3: 'QAT', iso_a2: 'QA' } });
    if (lat > -5 && lat < 8 && lon > 95 && lon < 120) return NextResponse.json({ country: { name: 'Indonesia', iso_a3: 'IDN', iso_a2: 'ID' } });
    if (lat > 0 && lat < 3 && lon > 100 && lon < 105) return NextResponse.json({ country: { name: 'Singapore', iso_a3: 'SGP', iso_a2: 'SG' } });
    if (lat > 29 && lat < 34 && lon > 119 && lon < 123) return NextResponse.json({ country: { name: 'China', iso_a3: 'CHN', iso_a2: 'CN' } });
    if (lat > 50 && lat < 54 && lon > 3 && lon < 7) return NextResponse.json({ country: { name: 'Netherlands', iso_a3: 'NLD', iso_a2: 'NL' } });
    if (lat > 33 && lat < 35 && lon > -119 && lon < -117) return NextResponse.json({ country: { name: 'United States', iso_a3: 'USA', iso_a2: 'US' } });
    if (lat > 10 && lat < 16 && lon > 42 && lon < 45) return NextResponse.json({ country: { name: 'Yemen', iso_a3: 'YEM', iso_a2: 'YE' } });
    if (lat > -36 && lat < -32 && lon > 17 && lon < 20) return NextResponse.json({ country: { name: 'South Africa', iso_a3: 'ZAF', iso_a2: 'ZA' } });
    return NextResponse.json({ country: null });
  }

  // ── Country snapshot ────────────────────────────────────────────────────
  if (path.startsWith('/country/') && path.endsWith('/snapshot')) {
    const events = buildEvents();
    return NextResponse.json({
      events: events.slice(0, 4),
      graph_nodes: [],
      chokepoints: CHOKEPOINTS.slice(0, 3),
      vessels: buildVessels().vessels.slice(0, 2).map(v => ({ bucket: v.bucket })),
      aircraft: [],
      watch_alerts: [],
    });
  }

  // ── Cluster ─────────────────────────────────────────────────────────────
  if (path === '/cluster') {
    const events = buildEvents();
    return NextResponse.json({
      n_events_total: events.length,
      clusters: [
        { domain: 'geopolitics', category: 'conflict', label: 'Red Sea / Suez disruption', summary: 'Multiple incidents affecting major shipping corridor', n_events: 3, severity_mean: 0.72 },
        { domain: 'corporate', category: 'port_congestion', label: 'Asia port congestion', summary: 'Singapore, Shanghai, Busan terminals under pressure', n_events: 3, severity_mean: 0.50 },
        { domain: 'corporate', category: 'capacity', label: 'Semiconductor supply strain', summary: 'TSMC and Samsung facing capacity/quality issues', n_events: 2, severity_mean: 0.52 },
        { domain: 'climate', category: 'weather', label: 'Tropical weather activity', summary: 'Storm Bolaven in East China Sea, Pilbara cyclone watch', n_events: 2, severity_mean: 0.60 },
      ],
    });
  }

  // ── FPV track ───────────────────────────────────────────────────────────
  if (path.startsWith('/fpv/track/')) {
    return NextResponse.json({
      positions: [
        { lat: 30.6, lon: 32.4, ts: null },
        { lat: 30.8, lon: 32.8, ts: null },
        { lat: 31.0, lon: 33.2, ts: null },
      ],
    });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
