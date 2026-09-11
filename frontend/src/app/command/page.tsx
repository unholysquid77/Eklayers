'use client';
import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  RefreshCw,
  Layers,
  ChevronRight,
  X,
  TrendingUp,
  Activity,
  Zap,
  Box,
  Truck,
  Anchor,
  Radio,
  Search,
  Cpu,
  Globe2,
  Share2,
  CheckCircle2,
  Sparkles,
  Database,
} from 'lucide-react';
import type {
  AlertCard,
  LayerVisibility,
  CascadeMap,
  Vessel,
  Flight,
  GeoFeatureCollection,
  RelationArc,
  Exposure,
  MitigationOption,
  ChokepointForecast,
  ShippingLane,
  ChokepointResearchDossier,
  ChokepointResearchReq,
} from '@/lib/contracts';
import { DEFAULT_LAYER_VISIBILITY, INFRA_LAYER_NAMES } from '@/lib/contracts';
import TacticalDrillDownModal from '@/components/TacticalDrillDownModal';
import { ChevronLeft } from 'lucide-react';
import {
  getAlerts,
  getGlobeCascadeMap,
  getGlobeVessels,
  getGlobeFlights,
  getGlobeEarthquakes,
  getGlobeShippingLanes,
  getGlobeOntologyEdges,
  getAllInfraLayers,
  resetDemo,
  ingestLive,
  getExposure,
  getMitigations,
  getChokepointForecast,
  researchChokepoint,
} from '@/lib/api';
import { MOCK_ALERTS, MOCK_CASCADE, MOCK_SHIPPING } from '@/lib/mock';

const SarvadarshiGlobe = dynamic(() => import('@/components/SarvadarshiGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-sm hud-text text-[#00ff88] bg-[#040806]">
      <Activity className="w-8 h-8 animate-spin text-[#00ff88]" />
      <span>INITIALISING 3D TACTICAL GLOBE SENSORS…</span>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Layer groups definition (14+ layers)
// ---------------------------------------------------------------------------

const LAYER_GROUPS = [
  {
    label: 'CORE CASCADE & ONTOLOGY',
    layers: [
      { key: 'chokepointPins', label: 'Chokepoint Pins', color: '#ef4444', defaultOn: true },
      { key: 'cascadeArcs', label: 'Cascade Arcs', color: '#f97316', defaultOn: true },
      { key: 'eventDots', label: 'Hazard Events', color: '#eab308', defaultOn: true },
      { key: 'bomArcs', label: 'BOM / Supply Arcs', color: '#06b6d4', defaultOn: true },
      { key: 'countryBorders', label: 'Country Borders', color: '#475569', defaultOn: true },
    ],
  },
  {
    label: 'LIVE SENSOR FEEDS',
    layers: [
      { key: 'vessels', label: 'Vessels (AIS Live)', color: '#3b82f6', defaultOn: true },
      { key: 'flights', label: 'Flight Corridors (OpenSky)', color: '#f8fafc', defaultOn: false },
      { key: 'earthquakes', label: 'USGS Earthquakes', color: '#ec4899', defaultOn: true },
      { key: 'shippingLanes', label: 'Shipping Mainlines', color: '#10b981', defaultOn: true },
      { key: 'landRoutes', label: 'Land Corridors', color: '#84cc16', defaultOn: false },
    ],
  },
  {
    label: 'GLOBAL STRATEGIC INFRASTRUCTURE',
    layers: [
      { key: 'ports', label: 'Strategic Ports', color: '#06b6d4', defaultOn: true },
      { key: 'warehouses', label: 'Regional Hubs', color: '#fbbf24', defaultOn: true },
      { key: 'refineries', label: 'Refineries', color: '#ea580c', defaultOn: false },
      { key: 'lngTerminals', label: 'LNG Terminals', color: '#14b8a6', defaultOn: false },
      { key: 'storageFacilities', label: 'Strategic Storage', color: '#94a3b8', defaultOn: false },
      { key: 'pipelines', label: 'Oil/Gas Pipelines', color: '#f59e0b', defaultOn: false },
      { key: 'powerLines', label: 'Power Grids', color: '#eab308', defaultOn: false },
      { key: 'underseaCables', label: 'Undersea Cables', color: '#0ea5e9', defaultOn: false },
      { key: 'dataCenters', label: 'AI Data Centers', color: '#38bdf8', defaultOn: false },
      { key: 'nuclearSites', label: 'Nuclear Facilities', color: '#d946ef', defaultOn: false },
      { key: 'militaryBases', label: 'Defense Bases', color: '#ef4444', defaultOn: false },
      { key: 'spaceports', label: 'Spaceports', color: '#a855f7', defaultOn: false },
      { key: 'economicCenters', label: 'Economic Hubs', color: '#e2e8f0', defaultOn: false },
    ],
  },
];

function getSevMeta(sev: number | string) {
  const num = typeof sev === 'number' ? sev : sev === 'critical' ? 85 : sev === 'high' ? 65 : sev === 'medium' ? 40 : 15;
  if (num >= 75) return { cls: 'severity-critical', label: 'CRITICAL', bar: '#ef4444', text: 'text-red-400' };
  if (num >= 50) return { cls: 'severity-high', label: 'HIGH', bar: '#f97316', text: 'text-orange-400' };
  if (num >= 25) return { cls: 'severity-medium', label: 'MEDIUM', bar: '#eab308', text: 'text-yellow-400' };
  return { cls: 'severity-low', label: 'LOW', bar: '#10b981', text: 'text-emerald-400' };
}

function ZuluClock() {
  const [t, setT] = useState<string>('');
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-[#040806]/80 border border-[#1c482c]/60 rounded text-xs hud-text text-[#00ff88] tabular-nums">
      <Clock className="w-3.5 h-3.5 text-[#00ff88] animate-pulse" />
      <span>{t || 'SYNCING ZULU TIME…'}</span>
    </div>
  );
}

export default function CommandPage() {
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [alerts, setAlerts] = useState<AlertCard[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertCard | null>(null);
  const [exposureList, setExposureList] = useState<Exposure[]>([]);
  const [mitigations, setMitigations] = useState<MitigationOption[]>([]);
  const [forecast, setForecast] = useState<ChokepointForecast | null>(null);
  const [cascadeData, setCascadeData] = useState<CascadeMap | null>(MOCK_CASCADE);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [earthquakes, setEarthquakes] = useState<GeoFeatureCollection | null>(null);
  const [shippingLanes, setShippingLanes] = useState<{ type: string; features: ShippingLane[] } | null>(null);
  const [bomArcs, setBomArcs] = useState<RelationArc[]>([]);
  const [infraLayers, setInfraLayers] = useState<Partial<Record<string, GeoFeatureCollection>>>({});
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'exposure' | 'forecast' | 'mitigations' | 'evidence'>('exposure');

  // Autonomous Research Drawer & Modal State
  const [researchOpen, setResearchOpen] = useState(false);
  const [researchQuery, setResearchQuery] = useState('Malacca Strait');
  const [researchCpId, setResearchCpId] = useState('lane-malacca');
  const [researchFocus, setResearchFocus] = useState('piracy, naval drills, tanker congestion');
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchStatusMsg, setResearchStatusMsg] = useState('');
  const [researchDossier, setResearchDossier] = useState<ChokepointResearchDossier | null>(null);
  const [layersOpen, setLayersOpen] = useState(true);
  const [alertsOpen, setAlertsOpen] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [drillDownTarget, setDrillDownTarget] = useState<{
    isOpen: boolean;
    lat: number;
    lon: number;
    title: string;
    category?: string;
    stress?: number;
  } | null>(null);

  const cpCount = cascadeData?.chokepoints.length ?? 0;
  const evCount = cascadeData?.events.length ?? 0;
  const arcCount = (cascadeData?.impact_edges.length ?? 0) + bomArcs.length;
  const peakStress = cascadeData?.chokepoints.reduce((m, c) => Math.max(m, c.stress_level), 0) ?? 0;

  const loadStatic = useCallback(async () => {
    setLoading(true);
    try {
      const [al, cd, sl, oe, infra] = await Promise.allSettled([
        getAlerts().catch(() => MOCK_ALERTS),
        getGlobeCascadeMap().catch(() => MOCK_CASCADE),
        getGlobeShippingLanes().catch(() => MOCK_SHIPPING),
        getGlobeOntologyEdges().catch(() => ({ arcs: [] })),
        getAllInfraLayers(INFRA_LAYER_NAMES).catch(() => ({})),
      ]);
      if (al.status === 'fulfilled') setAlerts(al.value && al.value.length ? al.value : MOCK_ALERTS);
      if (cd.status === 'fulfilled' && cd.value && cd.value.chokepoints && cd.value.chokepoints.length > 0) {
        setCascadeData(cd.value);
      } else {
        setCascadeData(MOCK_CASCADE);
      }
      if (sl.status === 'fulfilled' && sl.value) setShippingLanes(sl.value as { type: string; features: ShippingLane[] });
      if (oe.status === 'fulfilled' && oe.value && oe.value.arcs) setBomArcs(oe.value.arcs);
      if (infra.status === 'fulfilled' && infra.value) setInfraLayers(infra.value);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      await ingestLive().catch(() => {});
      const [vs, fl, eq, al, cd] = await Promise.allSettled([
        getGlobeVessels(),
        getGlobeFlights(1500),
        getGlobeEarthquakes(),
        getAlerts(),
        getGlobeCascadeMap(),
      ]);
      if (vs.status === 'fulfilled') setVessels(vs.value.vessels);
      if (fl.status === 'fulfilled') setFlights(fl.value.flights);
      if (eq.status === 'fulfilled') setEarthquakes(eq.value);
      if (al.status === 'fulfilled' && al.value.length) setAlerts(al.value);
      if (cd.status === 'fulfilled') setCascadeData(cd.value);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatic();
  }, [loadStatic]);

  const selectAlert = useCallback(async (a: AlertCard) => {
    setSelectedAlert(a);
    setActiveTab('exposure');
    setExposureList([]);
    setMitigations([]);
    setForecast(null);

    try {
      const [exp, mits, fc] = await Promise.allSettled([
        getExposure(a.id),
        getMitigations(a.id),
        getChokepointForecast(a.subject_id),
      ]);
      if (exp.status === 'fulfilled') setExposureList(exp.value || []);
      if (mits.status === 'fulfilled') setMitigations(mits.value || []);
      if (fc.status === 'fulfilled') setForecast(fc.value || null);
    } catch {
      // Fallback
    }
  }, []);

  const toggleLayer = useCallback((key: string) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key as keyof LayerVisibility] }));
  }, []);

  const handleReset = useCallback(async () => {
    await resetDemo();
    await loadStatic();
  }, [loadStatic]);

  const handleFeatureClick = useCallback(
    (f: { id: string; name: string; kind: string; data: unknown }) => {
      const match = alerts.find((a) => a.subject_id === f.id);
      if (match) selectAlert(match);
      else {
        // Pre-fill research modal
        setResearchCpId(f.id);
        setResearchQuery(f.name);
      }
    },
    [alerts, selectAlert]
  );

  // Autonomous Research Trigger
  const handleExecuteResearch = async () => {
    if (!researchQuery.trim()) return;
    setResearchLoading(true);
    setResearchStatusMsg('1/4 Fetching live maritime intelligence & Google News RSS...');
    try {
      const focusList = researchFocus
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      setTimeout(() => {
        setResearchStatusMsg('2/4 Computing Bayesian Log-Likelihood Ratio (LLR) weight updates...');
      }, 900);

      setTimeout(() => {
        setResearchStatusMsg('3/4 Mutating live ontology graph with newly discovered entities...');
      }, 1800);

      const dossier = await researchChokepoint({
        query: researchQuery,
        chokepoint_id: researchCpId || undefined,
        focus_areas: focusList.length ? focusList : undefined,
        depth: 2,
      });

      setResearchStatusMsg('4/4 Complete: Ontology synchronized.');
      setResearchDossier(dossier);

      // Refresh static data to pick up graph mutations
      await loadStatic();
    } catch (err: unknown) {
      setResearchStatusMsg(`Research failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResearchLoading(false);
    }
  };

  // Helper count for layers
  const layerCounts: Record<string, number> = useMemo(() => {
    return {
      chokepointPins: cascadeData?.chokepoints.length ?? 0,
      cascadeArcs: cascadeData?.impact_edges.length ?? 0,
      eventDots: cascadeData?.events.length ?? 0,
      bomArcs: bomArcs.length,
      countryBorders: 178,
      vessels: vessels.length,
      flights: flights.length,
      earthquakes: earthquakes?.features?.length ?? 0,
      shippingLanes: shippingLanes?.features?.length ?? 0,
      landRoutes: infraLayers?.land_routes?.features?.length ?? 0,
      ports: infraLayers?.ports?.features?.length ?? 0,
      warehouses: infraLayers?.warehouses?.features?.length ?? 0,
      refineries: infraLayers?.refineries?.features?.length ?? 0,
      lngTerminals: infraLayers?.lng_terminals?.features?.length ?? 0,
      storageFacilities: infraLayers?.storage_facilities?.features?.length ?? 0,
      pipelines: infraLayers?.pipelines?.features?.length ?? 0,
      powerLines: infraLayers?.power_lines?.features?.length ?? 0,
      underseaCables: infraLayers?.undersea_cables?.features?.length ?? 0,
      dataCenters: infraLayers?.data_centers?.features?.length ?? 0,
      nuclearSites: infraLayers?.nuclear_sites?.features?.length ?? 0,
      militaryBases: infraLayers?.military_bases?.features?.length ?? 0,
      spaceports: infraLayers?.spaceports?.features?.length ?? 0,
      economicCenters: infraLayers?.economic_centers?.features?.length ?? 0,
    };
  }, [cascadeData, bomArcs, vessels, flights, earthquakes, shippingLanes, infraLayers]);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] bg-[#040806] text-slate-100 overflow-hidden font-sans relative">
      {/* ── Floating Top Command HUD Pill ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full border border-[#143a22] bg-[#040806]/90 px-4 py-1.5 shadow-2xl backdrop-blur-md font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-ping" />
          <span className="text-[#00ff88] font-bold">DISRUPTION COMMAND</span>
        </div>
        <div className="h-3.5 w-px bg-[#143a22]" />
        <button
          onClick={() => setResearchOpen(true)}
          className="flex items-center gap-1.5 text-xs text-[#44ffa2] hover:text-white transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#00ff88] animate-pulse" />
          <span>AUTONOMOUS RESEARCH</span>
        </button>
        <div className="h-3.5 w-px bg-[#143a22]" />
        <ZuluClock />
      </div>

      {/* ── Main Command Viewport ── */}
      <div className="flex flex-1 overflow-hidden relative w-full h-full">
        {/* ── Floating Toggle for Left Sidebar (when collapsed) ── */}
        {!layersOpen && (
          <button
            onClick={() => setLayersOpen(true)}
            className="absolute top-14 left-3 z-30 flex items-center gap-2 rounded-lg border border-[#143a22] bg-[#07140b]/90 px-3 py-2 font-mono text-xs text-[#00ff88] shadow-xl backdrop-blur-md hover:bg-[#0c2214] transition-all"
            title="Open Tactical Layers"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="font-bold">LAYERS</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#87a894]" />
          </button>
        )}

        {/* ── Left Layer Toggles Sidebar (Collapsible) ── */}
        {layersOpen && (
          <aside className="w-64 shrink-0 bg-[#060d09]/95 border-r border-[#143a22] p-3 flex flex-col justify-between overflow-y-auto styled-scrollbar z-20">
            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#143a22]">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#00ff88]" />
                  <span className="hud-text text-xs font-bold text-slate-300">TACTICAL LAYERS</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#00ff88] font-mono">14 ACTIVE</span>
                  <button
                    onClick={() => setLayersOpen(false)}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#143a22]"
                    title="Collapse Layers Panel"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>


            {LAYER_GROUPS.map((grp) => (
              <div key={grp.label} className="mb-4">
                <div className="hud-text text-[9px] text-slate-500 uppercase tracking-wider mb-1.5 font-bold">
                  {grp.label}
                </div>
                <div className="space-y-1">
                  {grp.layers.map((lyr) => {
                    const count = layerCounts[lyr.key];
                    const active = !!layers[lyr.key as keyof LayerVisibility];
                    return (
                      <label
                        key={lyr.key}
                        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer select-none transition-colors ${
                          active ? 'bg-[#0a1710]/60 border border-[#1c482c]/40' : 'hover:bg-[#0a1710]/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: lyr.color, boxShadow: active ? `0 0 6px ${lyr.color}` : 'none' }}
                          />
                          <span className={`text-[11px] ${active ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                            {lyr.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {count !== undefined && count > 0 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#040806] border border-[#143a22] text-slate-400">
                              {count}
                            </span>
                          )}
                          <input
                            type="checkbox"
                            className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
                            checked={active}
                            onChange={() => toggleLayer(lyr.key)}
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded bg-[#040806]/90 border border-[#143a22] text-[10px] space-y-1 mt-3">
            <div className="flex justify-between text-slate-400 font-mono">
              <span>Sensor Fusion:</span>
              <span className="text-[#00ff88]">GDACS + USGS + AIS</span>
            </div>
            <div className="flex justify-between text-slate-400 font-mono">
              <span>Inference Engine:</span>
              <span className="text-emerald-400">Bayesian LLR + Kalman</span>
            </div>
          </div>
        </aside>
        )}

        {/* ── 3D Interactive Three.js Globe ── */}
        <main className="flex-1 relative bg-black">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#040806]/80 gap-3">
              <Activity className="w-10 h-10 text-[#00ff88] animate-spin" />
              <span className="hud-text text-sm text-[#44ffa2] font-semibold">SYNCHRONIZING GLOBAL RISK SENSORS…</span>
            </div>
          )}
          <SarvadarshiGlobe
            cascadeData={cascadeData}
            vessels={vessels}
            flights={flights}
            earthquakes={earthquakes}
            shippingLanes={shippingLanes}
            bomArcs={bomArcs}
            infraLayers={infraLayers as Record<string, GeoFeatureCollection>}
            activeLayers={layers}
            autoRotate={autoRotate}
            onToggleAutoRotate={() => setAutoRotate((prev) => !prev)}
            onFeatureClick={handleFeatureClick}
            onDrillDown={(target) => setDrillDownTarget({ ...target, isOpen: true })}
          />
        </main>

        {/* ── Floating Toggle for Right Sidebar (when collapsed) ── */}
        {!alertsOpen && (
          <button
            onClick={() => setAlertsOpen(true)}
            className="absolute top-14 right-3 z-30 flex items-center gap-2 rounded-lg border border-[#143a22] bg-[#07140b]/90 px-3 py-2 font-mono text-xs text-amber-400 shadow-xl backdrop-blur-md hover:bg-[#0c2214] transition-all"
            title="Open Live Disruption Feed"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-[#87a894]" />
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold">ALERTS ({alerts.length})</span>
          </button>
        )}

        {/* ── Right Disruption Alert Feed / Deep-Dive Drawer (Collapsible) ── */}
        {alertsOpen && (
        <aside className="w-96 shrink-0 bg-[#090e1d]/95 border-l border-[#143a22] flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#143a22] flex items-center justify-between bg-[#0d1426]">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span className="hud-text text-xs font-bold text-amber-400">LIVE DISRUPTION ALERTS</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#0a1710] text-slate-300 hud-text">
                {alerts.length} ACTIVE
              </span>
              <button
                onClick={() => setAlertsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#143a22]"
                title="Collapse Disruption Feed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {selectedAlert ? (
            /* ── Deep-Dive Alert Details Modal/Drawer ── */
            <div className="flex-1 overflow-y-auto styled-scrollbar p-4 space-y-4">
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-xs text-slate-400 hover:text-[#44ffa2] flex items-center gap-1 mb-2 font-mono"
              >
                <X className="w-3.5 h-3.5" /> CLOSE INSPECTION
              </button>

              {/* Alert Header Badge */}
              <div className="p-3 rounded-lg bg-[#040806] border border-[#1c482c]/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      getSevMeta(selectedAlert.severity).cls
                    }`}
                  >
                    {getSevMeta(selectedAlert.severity).label} SEVERITY
                  </span>
                  <span className="text-[11px] font-mono text-[#00ff88]">
                    Confidence: {(selectedAlert.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-100 leading-snug">
                  {selectedAlert.title || `${selectedAlert.alert_type.toUpperCase()} — ${selectedAlert.subject_id}`}
                </h3>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Subject: {selectedAlert.subject_id}</span>
                  <span className="uppercase">{selectedAlert.subject_kind}</span>
                </div>
              </div>

              {/* Bayesian Probability Lift Bar */}
              <div className="p-3 rounded bg-[#040806]/90 border border-[#143a22] space-y-1.5">
                <div className="flex justify-between text-[11px] hud-text">
                  <span className="text-slate-400">PRIOR PROBABILITY</span>
                  <span className="text-amber-400 font-bold">BAYESIAN POSTERIOR</span>
                </div>
                <div className="h-2.5 bg-[#0a1710] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-slate-600 transition-all"
                    style={{ width: `${selectedAlert.prior * 100}%` }}
                  />
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.max(0, (selectedAlert.posterior - selectedAlert.prior) * 100)}%`,
                      backgroundColor: getSevMeta(selectedAlert.severity).bar,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-400">{(selectedAlert.prior * 100).toFixed(1)}%</span>
                  <span className="text-amber-400 font-bold">
                    {(selectedAlert.posterior * 100).toFixed(1)}% (+
                    {((selectedAlert.posterior - selectedAlert.prior) * 100).toFixed(1)}pp lift)
                  </span>
                </div>
              </div>

              {/* Detail Navigation Tabs */}
              <div className="flex border-b border-[#143a22] text-xs font-mono">
                <button
                  onClick={() => setActiveTab('exposure')}
                  className={`pb-2 px-2.5 flex items-center gap-1 border-b-2 transition-colors ${
                    activeTab === 'exposure'
                      ? 'border-cyan-400 text-[#44ffa2] font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" /> BOM EXPOSURE
                </button>
                <button
                  onClick={() => setActiveTab('forecast')}
                  className={`pb-2 px-2.5 flex items-center gap-1 border-b-2 transition-colors ${
                    activeTab === 'forecast'
                      ? 'border-cyan-400 text-[#44ffa2] font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" /> LEAD TIME
                </button>
                <button
                  onClick={() => setActiveTab('mitigations')}
                  className={`pb-2 px-2.5 flex items-center gap-1 border-b-2 transition-colors ${
                    activeTab === 'mitigations'
                      ? 'border-cyan-400 text-[#44ffa2] font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" /> MITIGATIONS
                </button>
                <button
                  onClick={() => setActiveTab('evidence')}
                  className={`pb-2 px-2.5 flex items-center gap-1 border-b-2 transition-colors ${
                    activeTab === 'evidence'
                      ? 'border-cyan-400 text-[#44ffa2] font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" /> LLR
                </button>
              </div>

              {/* Tab 1: BOM Exposure Mapping */}
              {activeTab === 'exposure' && (
                <div className="space-y-2.5">
                  <div className="text-[11px] text-slate-400">
                    Traced downstream impact through Bill of Materials:
                  </div>
                  {exposureList.length === 0 ? (
                    <div className="p-3 bg-[#040806] rounded text-xs text-slate-500 text-center">
                      Calculating BOM cascade paths…
                    </div>
                  ) : (
                    exposureList.map((node) => (
                      <div
                        key={node.entity_id}
                        className="p-2.5 rounded bg-[#040806]/80 border border-[#143a22] space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0a1710] text-[#44ffa2] border border-[#1c482c] font-mono">
                              HOP {node.hop}
                            </span>
                            <span className="text-xs font-semibold text-slate-200">{node.entity_id}</span>
                          </div>
                          <span className="text-[11px] text-red-400 font-mono font-bold">
                            +{(node.expected_delay_days || 0).toFixed(1)}d delay
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>Probability: {(node.probability * 100).toFixed(0)}%</span>
                          <span>
                            Inventory Cover:{' '}
                            {node.inventory_days_cover != null ? `${node.inventory_days_cover}d` : 'Low Buffer'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 2: Kalman Lead-Time Forecast Fan */}
              {activeTab === 'forecast' && (
                <div className="space-y-3">
                  <div className="p-3 rounded bg-[#040806] border border-[#143a22] space-y-2">
                    <div className="text-xs font-bold text-slate-200 hud-text">
                      KALMAN STATE-SPACE PREDICTION
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded bg-[#0a1710]/80">
                        <div className="text-[10px] text-slate-400">P50 ARRIVAL</div>
                        <div className="text-sm font-bold text-[#00ff88] font-mono">
                          +{selectedAlert.p50_days ? selectedAlert.p50_days.toFixed(1) : '7.5'}d
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#0a1710]/80">
                        <div className="text-[10px] text-slate-400">P80 STRESS</div>
                        <div className="text-sm font-bold text-amber-400 font-mono">
                          +{selectedAlert.p80_days ? selectedAlert.p80_days.toFixed(1) : '14.2'}d
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[#0a1710]/80">
                        <div className="text-[10px] text-slate-400">P95 TAIL</div>
                        <div className="text-sm font-bold text-red-400 font-mono">
                          +{selectedAlert.p95_days ? selectedAlert.p95_days.toFixed(1) : '21.0'}d
                        </div>
                      </div>
                    </div>
                  </div>
                  {forecast && forecast.forecast && (
                    <div className="p-3 rounded bg-[#040806] border border-[#143a22] space-y-2">
                      <div className="text-[10px] text-slate-400 hud-text">14-DAY TRAJECTORY FAN</div>
                      <div className="space-y-1 text-[10px] font-mono">
                        {forecast.forecast.slice(0, 5).map((f) => (
                          <div key={f.day} className="flex justify-between py-0.5 border-b border-[#143a22]/50">
                            <span className="text-slate-400">Day +{f.day}</span>
                            <span className="text-[#44ffa2]">P50: {f.p50.toFixed(2)}</span>
                            <span className="text-amber-400">P80: {f.p80.toFixed(2)}</span>
                            <span className="text-red-400">P95: {f.p95.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Ranked Mitigations */}
              {activeTab === 'mitigations' && (
                <div className="space-y-2.5">
                  <div className="text-[11px] text-slate-400">
                    Recommended operational mitigation actions ranked by cost vs delay:
                  </div>
                  {mitigations.length === 0 ? (
                    <div className="p-3 bg-[#040806] rounded text-xs text-slate-500 text-center">
                      Loading mitigation options…
                    </div>
                  ) : (
                    mitigations.map((opt, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-[#040806]/90 border border-[#143a22] hover:border-cyan-500/50 transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#44ffa2] uppercase">
                            {opt.type || opt.option || 'Sourcing Alternative'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                            Save -{opt.expected_delay_reduction || opt.lead_time_reduction_days || 4}d
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">{opt.description}</p>
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
                          <span>Cost Impact: {((opt.cost_impact || 0.15) * 100).toFixed(0)}% premium</span>
                          <button className="text-[#00ff88] hover:underline">Execute Action →</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 4: Auditable Evidence Ledger (LLR) */}
              {activeTab === 'evidence' && (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-400">
                    Log-likelihood ratio contributions to posterior:
                  </div>
                  {selectedAlert.evidence_ledger && selectedAlert.evidence_ledger.length > 0 ? (
                    selectedAlert.evidence_ledger.map((ev, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded bg-[#040806]/90 border border-[#143a22] flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-semibold text-slate-200">{ev.name}</div>
                          <div className="text-[10px] text-slate-400">
                            Source: {ev.source} · Conf: {(ev.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-xs font-mono font-bold ${
                              ev.llr >= 0 ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {ev.llr >= 0 ? '+' : ''}
                            {ev.llr.toFixed(2)} LLR
                          </span>
                          <div className="text-[9px] text-slate-500">+{ev.contribution.toFixed(1)} pts</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-[#040806] rounded text-xs text-slate-500 text-center">
                      No LLR evidence items registered.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── Default Alert Roster View ── */
            <div className="flex-1 overflow-y-auto styled-scrollbar p-3 space-y-2.5">
              {alerts.map((a) => {
                const meta = getSevMeta(a.severity);
                return (
                  <div
                    key={a.id}
                    onClick={() => selectAlert(a)}
                    className="p-3 rounded-lg bg-[#040806]/80 border border-[#143a22] hover:border-cyan-500/50 hover:bg-[#0a1710]/60 cursor-pointer transition-all space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${meta.cls}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {(a.posterior * 100).toFixed(0)}% DISRUPTION
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-100 group-hover:text-[#44ffa2] transition-colors leading-tight">
                      {a.title || `${a.alert_type.toUpperCase()} — ${a.subject_id}`}
                    </h4>

                    {/* Mini progress bar */}
                    <div className="h-1.5 bg-[#0a1710] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${a.posterior * 100}%`, backgroundColor: meta.bar }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{a.subject_id}</span>
                      <span className="text-[#00ff88] flex items-center gap-0.5">
                        Inspect <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
        )}
      </div>

      {/* ── Autonomous Chokepoint Research Modal / Dossier HUD ── */}
      {researchOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-[#090f1e] border border-cyan-500/60 rounded-xl shadow-[0_0_40px_rgba(6,182,212,0.25)] flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-[#143a22] bg-[#0d162c] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-[#00ff88] animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 hud-text">AUTONOMOUS CHOKEPOINT RESEARCH ENGINE</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Real-time web scraping, Bayesian LLR inference, and graph ontology mutations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResearchOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#0a1710]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto styled-scrollbar space-y-4 flex-1">
              {/* Form Input Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#040806]/90 p-3.5 rounded-lg border border-[#143a22]">
                <div>
                  <label className="text-[10px] hud-text text-slate-400 block mb-1">TARGET CHOKEPOINT / TOPIC</label>
                  <input
                    type="text"
                    value={researchQuery}
                    onChange={(e) => setResearchQuery(e.target.value)}
                    placeholder="e.g. Malacca Strait, Bab-el-Mandeb, Panama Canal"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-[#1c482c] rounded text-xs text-slate-100 font-mono focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] hud-text text-slate-400 block mb-1">CHOKEPOINT ID (OPTIONAL)</label>
                  <input
                    type="text"
                    value={researchCpId}
                    onChange={(e) => setResearchCpId(e.target.value)}
                    placeholder="e.g. cp-malacca, cp-suez, cp-panama"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-[#1c482c] rounded text-xs text-slate-100 font-mono focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] hud-text text-slate-400 block mb-1">FOCUS AREAS / INTELLIGENCE FILTERS</label>
                  <input
                    type="text"
                    value={researchFocus}
                    onChange={(e) => setResearchFocus(e.target.value)}
                    placeholder="e.g. naval exercises, congestion, weather, piracy, strikes"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-[#1c482c] rounded text-xs text-slate-100 font-mono focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    onClick={handleExecuteResearch}
                    disabled={researchLoading || !researchQuery.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-[#0a1710] text-slate-950 font-bold rounded text-xs font-mono transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:text-slate-500"
                  >
                    <Search className={`w-4 h-4 ${researchLoading ? 'animate-spin' : ''}`} />
                    {researchLoading ? 'RUNNING RESEARCH PIPELINE…' : 'DEPLOY AUTONOMOUS RESEARCH AGENT'}
                  </button>
                </div>
              </div>

              {/* Live Status Telemetry Log */}
              {researchStatusMsg && (
                <div className="p-2.5 rounded bg-slate-950 border border-cyan-800/60 flex items-center gap-2 text-xs font-mono text-[#44ffa2]">
                  <Activity className="w-4 h-4 text-[#00ff88] animate-spin shrink-0" />
                  <span>{researchStatusMsg}</span>
                </div>
              )}

              {/* Research Dossier Results */}
              {researchDossier && (
                <div className="space-y-4 pt-2">
                  {/* Top Dossier Card */}
                  <div className="p-4 rounded-lg bg-[#040806] border border-[#1c482c]/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded font-mono font-bold uppercase bg-red-950/80 text-red-300 border border-red-800">
                          {researchDossier.risk_level || (researchDossier.severity && researchDossier.severity >= 0.7 ? 'CRITICAL' : 'HIGH')} RISK
                        </span>
                        <span className="text-sm font-bold text-slate-100">
                          {researchDossier.target_chokepoint || researchDossier.chokepoint_name || researchDossier.chokepoint_id}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold font-mono text-amber-400">
                          {(((researchDossier.disruption_score ?? researchDossier.severity ?? 0.75) * 100)).toFixed(0)}%
                        </div>
                        <div className="text-[9px] text-slate-500 hud-text">DISRUPTION PROBABILITY</div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded border border-[#143a22] font-sans">
                      {researchDossier.summary}
                    </p>
                  </div>

                  {/* Discovered Entities & Factors Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Key Risk Factors */}
                    <div className="p-3.5 rounded-lg bg-[#040806]/90 border border-[#143a22] space-y-2">
                      <div className="hud-text text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> KEY RISK FACTORS (LLR)
                      </div>
                      <div className="space-y-1.5 text-[11px] font-mono">
                        {(researchDossier.key_factors || (researchDossier.discovered_facts?.map((f) => ({ factor: f, llr_contribution: 1.25 })) || [])).map((f, i) => (
                          <div key={i} className="p-2 rounded bg-slate-950/80 border border-[#143a22] flex justify-between items-center">
                            <span className="text-slate-300">{f.factor}</span>
                            <span className="text-red-400 font-bold">+{f.llr_contribution.toFixed(2)} LLR</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Discovered Entities */}
                    <div className="p-3.5 rounded-lg bg-[#040806]/90 border border-[#143a22] space-y-2">
                      <div className="hud-text text-xs font-bold text-[#00ff88] flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5" /> IDENTIFIED GRAPH ENTITIES
                      </div>
                      <div className="space-y-1.5 text-[11px] font-mono">
                        {(researchDossier.identified_entities || (researchDossier.affected_commodities?.map((c) => ({ name: c, type: 'COMMODITY' })) || [])).map((e, i) => (
                          <div key={i} className="p-2 rounded bg-slate-950/80 border border-[#143a22] flex justify-between items-center">
                            <span className="text-slate-200 font-semibold">{e.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0a1710] text-[#44ffa2] border border-[#1c482c]">
                              {e.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Graph Mutations Card */}
                  <div className="p-3.5 rounded-lg bg-[#040806]/90 border border-[#143a22] space-y-2">
                    <div className="hud-text text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" /> ONTOLOGY GRAPH MUTATIONS APPLIED
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-slate-950/80 border border-[#143a22] text-center">
                        <div className="text-base font-bold text-[#00ff88]">
                          +{researchDossier.graph_mutations_applied?.nodes_added ?? researchDossier.ontology_mutations?.nodes_added ?? 0}
                        </div>
                        <div className="text-[10px] text-slate-400">NODES INJECTED</div>
                      </div>
                      <div className="p-2 rounded bg-slate-950/80 border border-[#143a22] text-center">
                        <div className="text-base font-bold text-amber-400">
                          +{researchDossier.graph_mutations_applied?.edges_added ?? researchDossier.ontology_mutations?.edges_added ?? 0}
                        </div>
                        <div className="text-[10px] text-slate-400">RELATION ARCS (DISRUPTS/AMPLIFIES)</div>
                      </div>
                    </div>
                  </div>

                  {/* Actionable Mitigations */}
                  {researchDossier.recommended_mitigations && researchDossier.recommended_mitigations.length > 0 && (
                    <div className="p-3.5 rounded-lg bg-[#040806]/90 border border-[#143a22] space-y-2">
                      <div className="hud-text text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#00ff88]" /> RECOMMENDED MITIGATIONS
                      </div>
                      <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside font-sans">
                        {researchDossier.recommended_mitigations.map((m, i) => (
                          <li key={i} className="leading-relaxed">
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#143a22] bg-[#0a0f1d] flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">
                Model: Google News Ingestion + Bayesian LLR Engine v2.4
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setResearchOpen(false)}
                  className="px-3 py-1.5 text-xs font-mono rounded bg-[#0a1710] hover:bg-slate-700 text-slate-300"
                >
                  DISMISS
                </button>
                <button
                  onClick={() => {
                    loadStatic();
                    setResearchOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs font-mono rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold"
                >
                  APPLY & SYNC GLOBE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── 2D High-Resolution Google Earth / Satellite Tactical Drill-Down Modal ── */}
      {drillDownTarget && (
        <TacticalDrillDownModal
          isOpen={drillDownTarget.isOpen}
          onClose={() => setDrillDownTarget(null)}
          lat={drillDownTarget.lat}
          lon={drillDownTarget.lon}
          title={drillDownTarget.title}
          category={drillDownTarget.category}
          stress={drillDownTarget.stress}
        />
      )}

      {/* ── Bottom Telemetry Status Strip ── */}
      <footer className="flex items-center justify-between px-4 py-2 border-t border-[#143a22] bg-[#0a0f1d] shrink-0 text-[11px] hud-text">
        <div className="flex items-center gap-6 text-slate-400">
          <span>
            CHOKEPOINTS: <strong className="text-[#00ff88]">{cpCount}</strong>
          </span>
          <span>
            HAZARD EVENTS: <strong className="text-amber-400">{evCount}</strong>
          </span>
          <span>
            RELATION ARCS: <strong className="text-slate-200">{arcCount}</strong>
          </span>
          <span>
            MAX STRESS:{' '}
            <strong
              style={{
                color: peakStress > 0.6 ? '#ef4444' : peakStress > 0.3 ? '#eab308' : '#10b981',
              }}
            >
              {(peakStress * 100).toFixed(1)}%
            </strong>
          </span>
        </div>

        <button
          onClick={loadLive}
          disabled={liveLoading}
          className="btn-tactical text-xs px-3 py-1 rounded flex items-center gap-1.5 disabled:opacity-50"
        >
          <Radio className={`w-3.5 h-3.5 ${liveLoading ? 'animate-spin' : 'text-[#00ff88]'}`} />
          {liveLoading ? 'PULLING SENSORS…' : '⬇ INGEST LIVE FEEDS'}
        </button>
      </footer>
    </div>
  );
}
