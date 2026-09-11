'use client';
import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { AlertCard, LayerVisibility, CascadeMap, Vessel, Flight, GeoFeatureCollection, RelationArc, InfraLayerName } from '@/lib/contracts';
import { DEFAULT_LAYER_VISIBILITY, INFRA_LAYER_NAMES } from '@/lib/contracts';
import {
  getAlerts, getGlobeCascadeMap, getGlobeVessels, getGlobeFlights,
  getGlobeEarthquakes, getGlobeShippingLanes, getGlobeOntologyEdges,
  getAllInfraLayers, resetDemo, ingestLive, getExposure,
} from '@/lib/api';

const SarvadarshiGlobe = dynamic(() => import('@/components/SarvadarshiGlobe'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center text-sm hud-text text-[var(--text-muted)]">INITIALISING GLOBE…</div>,
});

// ---------------------------------------------------------------------------
// Layer panel config
// ---------------------------------------------------------------------------

const LAYER_GROUPS = [
  {
    label: 'CORE CASCADE',
    layers: [
      { key: 'chokepointPins', label: 'Chokepoint Pins', color: '#ff4444' },
      { key: 'cascadeArcs',   label: 'Cascade Arcs',    color: '#ff8800' },
      { key: 'eventDots',     label: 'Event Dots',       color: '#ffcc00' },
      { key: 'bomArcs',       label: 'BOM / Supply Arcs',color: '#00ccff' },
      { key: 'countryBorders',label: 'Country Borders',  color: '#334455' },
    ],
  },
  {
    label: 'LIVE FEEDS',
    layers: [
      { key: 'vessels', label: 'Ships (AIS)',    color: '#4488ff' },
      { key: 'flights', label: 'Flights (Live)', color: '#ffffff' },
      { key: 'earthquakes', label: 'Earthquakes', color: '#ff44aa' },
    ],
  },
  {
    label: 'LOGISTICS',
    layers: [
      { key: 'shippingLanes', label: 'Shipping Lanes', color: '#44ff88' },
      { key: 'landRoutes',    label: 'Land Routes',    color: '#88ff44' },
      { key: 'ports',         label: 'Ports',          color: '#00ccff' },
      { key: 'airports',      label: 'Airports',       color: '#ffffff' },
      { key: 'warehouses',    label: 'Warehouses',     color: '#ffcc44' },
    ],
  },
  {
    label: 'ENERGY',
    layers: [
      { key: 'pipelines',       label: 'Pipelines',          color: '#ffaa00' },
      { key: 'powerLines',      label: 'Power Lines',         color: '#ffff00' },
      { key: 'refineries',      label: 'Refineries',          color: '#ff8800' },
      { key: 'lngTerminals',    label: 'LNG Terminals',       color: '#00ffcc' },
      { key: 'storageFacilities',label:'Storage Facilities',  color: '#aaaaaa' },
    ],
  },
  {
    label: 'INFRASTRUCTURE',
    layers: [
      { key: 'underseaCables',  label: 'Undersea Cables',   color: '#00ccff' },
      { key: 'economicCenters', label: 'Economic Centers',  color: '#ffd700' },
      { key: 'dataCenters',     label: 'AI Data Centers',   color: '#44ffff' },
    ],
  },
  {
    label: 'STRATEGIC',
    layers: [
      { key: 'nuclearSites',   label: 'Nuclear Sites',    color: '#ff44ff' },
      { key: 'militaryBases',  label: 'Military Bases',   color: '#ff4444' },
      { key: 'spaceports',     label: 'Spaceports',       color: '#ccccff' },
    ],
  },
];

const SEV_META = {
  critical: { cls: 'severity-critical', label: 'CRIT', bar: 'var(--alert-red)' },
  high:     { cls: 'severity-high',     label: 'HIGH', bar: '#ff8800' },
  medium:   { cls: 'severity-medium',   label: 'MED',  bar: '#ffcc00' },
  low:      { cls: 'severity-low',      label: 'LOW',  bar: 'var(--alert-green)' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ZuluClock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().replace('T', 'Z ').slice(0, 20) + 'Z');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="hud-text text-xs text-[var(--cyan-primary)] tabular-nums">{t}</span>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CommandPage() {
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [alerts, setAlerts] = useState<AlertCard[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertCard | null>(null);
  const [exposureNodes, setExposureNodes] = useState<{ node_id: string; node_name: string; exposure_score: number }[]>([]);
  const [cascadeData, setCascadeData] = useState<CascadeMap | null>(null);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [earthquakes, setEarthquakes] = useState<GeoFeatureCollection | null>(null);
  const [shippingLanes, setShippingLanes] = useState<{ type: string; features: unknown[] } | null>(null);
  const [bomArcs, setBomArcs] = useState<RelationArc[]>([]);
  const [infraLayers, setInfraLayers] = useState<Partial<Record<string, GeoFeatureCollection>>>({});
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(false);

  // Stats
  const cpCount  = cascadeData?.chokepoints.length ?? 0;
  const evCount  = cascadeData?.events.length ?? 0;
  const arcCount = cascadeData?.impact_edges.length ?? 0;
  const peakStress = cascadeData?.chokepoints.reduce((m, c) => Math.max(m, c.stress_level), 0) ?? 0;

  const loadStatic = useCallback(async () => {
    setLoading(true);
    try {
      const [al, cd, sl, oe, infra] = await Promise.allSettled([
        getAlerts(),
        getGlobeCascadeMap(),
        getGlobeShippingLanes(),
        getGlobeOntologyEdges(),
        getAllInfraLayers(INFRA_LAYER_NAMES),
      ]);
      if (al.status === 'fulfilled') setAlerts(al.value);
      if (cd.status === 'fulfilled') setCascadeData(cd.value);
      if (sl.status === 'fulfilled') setShippingLanes(sl.value as { type: string; features: unknown[] });
      if (oe.status === 'fulfilled') setBomArcs(oe.value.arcs);
      if (infra.status === 'fulfilled') setInfraLayers(infra.value);
    } finally { setLoading(false); }
  }, []);

  const loadLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const [vs, fl, eq] = await Promise.allSettled([
        getGlobeVessels(),
        getGlobeFlights(1500),
        getGlobeEarthquakes(),
      ]);
      if (vs.status === 'fulfilled') setVessels(vs.value.vessels);
      if (fl.status === 'fulfilled') setFlights(fl.value.flights);
      if (eq.status === 'fulfilled') setEarthquakes(eq.value);
    } finally { setLiveLoading(false); }
  }, []);

  useEffect(() => { loadStatic(); }, [loadStatic]);

  const selectAlert = useCallback(async (a: AlertCard) => {
    setSelectedAlert(a);
    try {
      const nodes = await getExposure(a.id);
      setExposureNodes(nodes.slice(0, 8));
    } catch { setExposureNodes([]); }
  }, []);

  const toggleLayer = useCallback((key: string) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key as keyof LayerVisibility] }));
  }, []);

  const handleReset = useCallback(async () => {
    await resetDemo();
    loadStatic();
  }, [loadStatic]);

  const handleFeatureClick = useCallback((f: { id: string; name: string; kind: string; data: unknown }) => {
    // Focus sidebar if matching alert exists
    const match = alerts.find(a => a.subject_id === f.id);
    if (match) selectAlert(match);
  }, [alerts, selectAlert]);

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-void)] text-[var(--text-primary)] overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[var(--gold-primary)] font-bold text-sm tracking-widest hud-text">SARVADARSHI</span>
          <span className="hud-text text-xs text-[var(--text-muted)]">·</span>
          <span className="hud-text text-xs text-[var(--cyan-primary)]">COMMAND</span>
          <span className="hud-text text-xs text-[var(--text-muted)]">PS #3 — DISRUPTION PREDICTION</span>
        </div>
        <ZuluClock />
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="btn-tactical text-xs px-3 py-1">RESET DEMO</button>
          <a href="/risk" className="btn-tactical--cyan text-xs px-3 py-1">RISK DASHBOARD →</a>
        </div>
      </div>

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Layer panel ── */}
        <div className="w-52 shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border-primary)] overflow-y-auto styled-scrollbar py-2 px-2">
          {LAYER_GROUPS.map(grp => (
            <div key={grp.label} className="mb-3">
              <div className="hud-text text-[10px] text-[var(--text-muted)] mb-1 px-1">{grp.label}</div>
              {grp.layers.map(lyr => (
                <label key={lyr.key} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[var(--bg-tertiary)] cursor-pointer select-none">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: lyr.color }} />
                  <input
                    type="checkbox"
                    className="accent-[var(--cyan-primary)] w-3 h-3 shrink-0"
                    checked={!!layers[lyr.key as keyof LayerVisibility]}
                    onChange={() => toggleLayer(lyr.key)}
                  />
                  <span className="text-[11px] text-[var(--text-secondary)] truncate">{lyr.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>

        {/* ── Globe ── */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-void)]/70">
              <span className="hud-text text-sm text-[var(--cyan-primary)] animate-pulse">LOADING SARVADARSHI DATA…</span>
            </div>
          )}
          <SarvadarshiGlobe
            cascadeData={cascadeData}
            vessels={vessels}
            flights={flights}
            earthquakes={earthquakes}
            shippingLanes={shippingLanes as { type: string; features: import('@/lib/contracts').ShippingLane[] } | null}
            bomArcs={bomArcs}
            infraLayers={infraLayers as Record<string, GeoFeatureCollection>}
            activeLayers={layers}
            onFeatureClick={handleFeatureClick}
          />
        </div>

        {/* ── Alert sidebar ── */}
        <div className="w-80 shrink-0 bg-[var(--bg-secondary)] border-l border-[var(--border-primary)] flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border-primary)] flex items-center justify-between">
            <span className="hud-text text-xs text-[var(--gold-primary)]">DISRUPTION ALERTS</span>
            <span className="text-[10px] text-[var(--text-muted)]">{alerts.length} active</span>
          </div>

          {selectedAlert ? (
            <div className="flex-1 overflow-y-auto styled-scrollbar p-3">
              <button onClick={() => setSelectedAlert(null)} className="text-xs text-[var(--text-muted)] hover:text-[var(--cyan-primary)] mb-3">← Back to list</button>
              <div className={`text-[10px] font-bold px-2 py-0.5 rounded mb-2 inline-block ${SEV_META[selectedAlert.severity].cls}`}>
                {SEV_META[selectedAlert.severity].label}
              </div>
              <div className="text-sm font-semibold mb-1">{selectedAlert.title}</div>
              <div className="text-[11px] text-[var(--text-muted)] mb-3">{selectedAlert.subject_id}</div>

              {/* Posterior bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                  <span>PRIOR</span><span>POSTERIOR</span>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${selectedAlert.posterior * 100}%`, background: SEV_META[selectedAlert.severity].bar }} />
                </div>
                <div className="flex justify-between text-[10px] mt-0.5">
                  <span className="text-[var(--text-muted)]">{(selectedAlert.prior * 100).toFixed(1)}%</span>
                  <span className="text-[var(--gold-primary)] font-bold">{(selectedAlert.posterior * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Evidence ledger */}
              <div className="mb-3">
                <div className="hud-text text-[10px] text-[var(--text-muted)] mb-1">EVIDENCE (LLR)</div>
                {selectedAlert.evidence.slice(0, 5).map((ev, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] py-0.5 border-b border-[var(--border-primary)]/40">
                    <span className="text-[var(--text-secondary)] truncate max-w-[60%]">{ev.signal_type}</span>
                    <span className={`font-bold ${ev.llr >= 0 ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}`}>
                      {ev.llr >= 0 ? '+' : ''}{ev.llr.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* BOM exposure */}
              {exposureNodes.length > 0 && (
                <div className="mb-3">
                  <div className="hud-text text-[10px] text-[var(--text-muted)] mb-1">BOM EXPOSURE</div>
                  {exposureNodes.map(n => (
                    <div key={n.node_id} className="flex items-center justify-between text-[11px] py-0.5">
                      <span className="text-[var(--text-secondary)] truncate max-w-[60%]">{n.node_name}</span>
                      <div className="w-16 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--alert-red)]" style={{ width: `${n.exposure_score * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto styled-scrollbar">
              {alerts.length === 0 && !loading && (
                <div className="p-4 text-center text-xs text-[var(--text-muted)]">No active alerts. Load live data or reset demo.</div>
              )}
              {alerts.map(a => (
                <div
                  key={a.id}
                  className="alert-card cursor-pointer border-b border-[var(--border-primary)]/30 hover:bg-[var(--bg-tertiary)]"
                  onClick={() => selectAlert(a)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SEV_META[a.severity].cls}`}>{SEV_META[a.severity].label}</span>
                    <span className="text-[10px] font-bold text-[var(--gold-primary)]">{(a.posterior * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-[11px] font-semibold leading-tight mb-1">{a.title}</div>
                  <div className="h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${a.posterior * 100}%`, background: SEV_META[a.severity].bar }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-[var(--text-muted)]">{a.evidence.length} signals</span>
                    <span className={`text-[9px] ${a.delta >= 0 ? 'text-[var(--alert-red)]' : 'text-[var(--alert-green)]'}`}>
                      {a.delta >= 0 ? '▲' : '▼'} {Math.abs(a.delta * 100).toFixed(1)}pp
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom status bar ── */}
      <div className="flex items-center gap-6 px-4 py-1.5 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] shrink-0 text-[10px]">
        <span className="hud-text text-[var(--text-muted)]">CHOKEPOINTS: <span className="text-[var(--cyan-primary)] font-bold">{cpCount}</span></span>
        <span className="hud-text text-[var(--text-muted)]">EVENTS: <span className="text-[var(--gold-primary)] font-bold">{evCount}</span></span>
        <span className="hud-text text-[var(--text-muted)]">IMPACT ARCS: <span className="text-[var(--text-secondary)] font-bold">{arcCount}</span></span>
        <span className="hud-text text-[var(--text-muted)]">PEAK STRESS:
          <span className="font-bold ml-1" style={{ color: peakStress > 0.6 ? 'var(--alert-red)' : peakStress > 0.3 ? '#ffcc00' : 'var(--alert-green)' }}>
            {(peakStress * 100).toFixed(1)}%
          </span>
        </span>
        <div className="flex-1" />
        <button
          onClick={loadLive}
          disabled={liveLoading}
          className="btn-tactical--cyan text-[10px] px-3 py-1 disabled:opacity-50"
        >
          {liveLoading ? 'LOADING…' : '⬇ LOAD LIVE DATA'}
        </button>
      </div>
    </div>
  );
}
