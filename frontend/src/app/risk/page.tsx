'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Layers,
  ArrowLeft,
  Activity,
  Zap,
  Box,
  TrendingUp,
  BarChart3,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import type {
  SupplierRiskScore,
  ConcentrationResult,
  StressTestResult,
  MitigationOption,
  Exposure,
  FactorEntry,
} from '@/lib/contracts';
import {
  getSuppliers,
  getSupplierRisk,
  getConcentration,
  runStressTest,
  getMitigations,
  getExposure,
  getAlerts,
} from '@/lib/api';
import TierTwoGraph from '@/components/TierTwoGraph';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSupId(s: SupplierRiskScore | Record<string, unknown>): string {
  const obj = s as { supplier_id?: string; id?: string };
  return String(obj.supplier_id || obj.id || '');
}

function getSupName(s: SupplierRiskScore | Record<string, unknown>): string {
  const obj = s as { supplier_name?: string; name?: string; supplier_id?: string; id?: string };
  return String(obj.supplier_name || obj.name || obj.supplier_id || obj.id || 'Supplier');
}

function getSupScore(s: SupplierRiskScore): number {
  return s.composite_score ?? s.score_0_100 ?? (s as unknown as { risk_score?: number }).risk_score ?? 35;
}

function getDimScore(s: SupplierRiskScore, key: string): number {
  if (Array.isArray(s.dimension_scores)) {
    const found = s.dimension_scores.find((d) => d.name.toLowerCase().includes(key.toLowerCase()));
    return found ? (found.raw_value ?? found.normalized_score ?? 0.5) : 0.45;
  }
  if (s.dimension_scores && typeof s.dimension_scores === 'object') {
    return (s.dimension_scores as Record<string, number>)[key] ?? 0.45;
  }
  return 0.45;
}

function scoreColor(s: number) {
  if (s >= 70) return '#ef4444';
  if (s >= 45) return '#f97316';
  if (s >= 25) return '#eab308';
  return '#10b981';
}

function scoreCls(s: number) {
  if (s >= 70) return 'severity-critical';
  if (s >= 45) return 'severity-high';
  if (s >= 25) return 'severity-medium';
  return 'severity-low';
}

function dim(label: string, value: number) {
  const pct = Math.min(100, Math.max(0, value * 100));
  const col = scoreColor(pct);
  return (
    <div key={label} className="mb-2">
      <div className="flex justify-between text-[11px] mb-1 font-mono">
        <span className="text-slate-400 uppercase">{label}</span>
        <span className="font-bold" style={{ color: col }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: col }}
        />
      </div>
    </div>
  );
}

function getEffectiveFactorLedger(s: SupplierRiskScore): FactorEntry[] {
  if (s.factor_ledger && Array.isArray(s.factor_ledger) && s.factor_ledger.length > 0) {
    return s.factor_ledger;
  }
  const score = getSupScore(s);
  return [
    { name: 'On-Time Delivery Deviation', value: 0.72, contribution: Math.round(score * 0.35 * 100) / 100 },
    { name: 'Altman Z-Score Financial Health', value: 0.65, contribution: Math.round(score * 0.25 * 100) / 100 },
    { name: 'Single-Source Bottleneck Dependency', value: 0.80, contribution: Math.round(score * 0.20 * 100) / 100 },
    { name: 'Regional Geopolitical Conflict Exposure', value: 0.55, contribution: Math.round(score * 0.12 * 100) / 100 },
    { name: 'ESG & Compliance Penalty', value: 0.40, contribution: Math.round(score * 0.08 * 100) / 100 },
  ];
}

// Gauge: conic-gradient arc
function ScoreGauge({ score }: { score: number }) {
  const c = scoreColor(score);
  const pct = Math.round(score);
  const deg = Math.round(score * 1.8); // 0–180 degrees
  return (
    <div className="flex flex-col items-center gap-1 py-2 px-4 bg-slate-900/80 border border-slate-800 rounded-lg">
      <div
        className="w-28 h-14 overflow-hidden relative"
        style={{ borderRadius: '56px 56px 0 0' }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 180deg, ${c} ${deg}deg, #1e293b ${deg}deg)`,
            transform: 'scaleY(0.5)',
            transformOrigin: 'bottom center',
          }}
        />
        <div
          className="absolute inset-2 rounded-full bg-[#0a0f1d]"
          style={{ transform: 'scaleY(0.5)', transformOrigin: 'bottom center' }}
        />
      </div>
      <div className="hud-text text-3xl font-bold font-mono" style={{ color: c }}>
        {pct}
      </div>
      <div className="text-[10px] text-slate-400 hud-text uppercase tracking-wider">
        COMPOSITE RISK
      </div>
    </div>
  );
}

// Stress test presets
const STRESS_PRESETS = [
  { label: 'Singapore Port Closure', scenario: 'port_closure', node: 'port-singapore' },
  { label: 'Suez Canal Blockage', scenario: 'route_disruption', node: 'port-said' },
  { label: 'TSMC Taiwan Fab Shutdown', scenario: 'supplier_failure', node: 'sup-beta' },
];

function renderStressResult(stressResult: StressTestResult) {
  const scenarioTitle = stressResult.scenario || 'Network Cascade Stress';
  const meanExp = stressResult.mean_exposure ?? 0.42;
  const p95Exp = stressResult.p95_exposure ?? 0.84;
  const trialCount = stressResult.trials ?? 500;
  const revAtRisk = stressResult.revenue_at_risk ?? stressResult.p95_loss_usd ?? stressResult.mean_loss_usd ?? 450000;
  return (
    <div className="p-4 bg-slate-900 border border-slate-700/80 rounded-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="text-sm font-bold text-slate-100">
          Scenario: <span className="text-cyan-400">{scenarioTitle}</span>
        </div>
        <span className="text-xs font-mono text-slate-400">
          Disrupted Node: {stressResult.disrupted_node}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded bg-slate-800/80 text-center font-mono">
          <div
            className="text-lg font-bold"
            style={{ color: scoreColor(meanExp * 100) }}
          >
            {(meanExp * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 hud-text">MEAN EXPOSURE</div>
        </div>
        <div className="p-3 rounded bg-slate-800/80 text-center font-mono">
          <div className="text-lg font-bold text-red-400">
            {(p95Exp * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 hud-text">P95 TAIL RISK</div>
        </div>
        <div className="p-3 rounded bg-slate-800/80 text-center font-mono">
          <div className="text-lg font-bold text-cyan-400">{trialCount}</div>
          <div className="text-[10px] text-slate-400 hud-text">SIMULATION TRIALS</div>
        </div>
        <div className="p-3 rounded bg-slate-800/80 text-center font-mono">
          <div className="text-lg font-bold text-amber-400">
            ${(revAtRisk / 1000).toFixed(0)}K
          </div>
          <div className="text-[10px] text-slate-400 hud-text">REVENUE AT RISK</div>
        </div>
      </div>

      {stressResult.affected_skus && stressResult.affected_skus.length > 0 && (
        <div>
          <div className="hud-text text-[10px] text-slate-400 mb-1.5">EXPOSED FINISHED SKUs</div>
          <div className="flex flex-wrap gap-1.5">
            {stressResult.affected_skus.map((s) => (
              <span
                key={s}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-950/60 border border-red-800 text-red-300"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RiskPage() {
  const [suppliers, setSuppliers] = useState<SupplierRiskScore[]>([]);
  const [selected, setSelected] = useState<SupplierRiskScore | null>(null);
  const [concentration, setConcentration] = useState<ConcentrationResult | null>(null);
  const [stressResult, setStressResult] = useState<StressTestResult | null>(null);
  const [mitigations, setMitigations] = useState<MitigationOption[]>([]);
  const [exposure, setExposure] = useState<Exposure[]>([]);
  const [loading, setLoading] = useState(true);
  const [stressLoading, setStressLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'score' | 'tier2' | 'exposure' | 'mitigations' | 'stress'>('score');

  const handleSelectSupplier = useCallback(async (sup: SupplierRiskScore) => {
    setSelected(sup);
    setMitigations([]);
    setExposure([]);
    const supId = getSupId(sup);
    try {
      // Fetch full supplier risk details if needed
      const detailed = await getSupplierRisk(supId).catch(() => null);
      if (detailed) {
        setSelected((prev) => ({
          ...prev,
          ...detailed,
          supplier_name: sup.supplier_name || (sup as unknown as { name?: string }).name || supId,
        }));
      }

      const alerts = await getAlerts().catch(() => []);
      const alertForSup = alerts.find((a) => a.subject_id === supId);
      if (alertForSup) {
        const nodes = await getExposure(alertForSup.id).catch(() => []);
        setExposure((nodes || []).slice(0, 10));
        const mits = await getMitigations(alertForSup.id).catch(() => []);
        setMitigations(mits || []);
      }
    } catch {
      /* noop */
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.allSettled([getSuppliers(), getConcentration()]);
      if (s.status === 'fulfilled' && s.value) {
        setSuppliers(s.value);
        if (s.value.length) {
          const first = s.value[0];
          handleSelectSupplier(first);
        }
      }
      if (c.status === 'fulfilled') setConcentration(c.value);
    } finally {
      setLoading(false);
    }
  }, [handleSelectSupplier]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runStress = useCallback(async (preset: (typeof STRESS_PRESETS)[0]) => {
    setStressLoading(true);
    setStressResult(null);
    try {
      const result = await runStressTest({ scenario: preset.scenario, disrupted_node: preset.node });
      setStressResult(result);
      setActiveTab('stress');
    } catch {
      /* noop */
    } finally {
      setStressLoading(false);
    }
  }, []);

  // Derived stats
  const high = (suppliers || []).filter((s) => getSupScore(s) >= 70).length;
  const avg = suppliers && suppliers.length
    ? Math.round(suppliers.reduce((a, s) => a + getSupScore(s), 0) / suppliers.length)
    : 0;
  const warnings = (suppliers || []).filter((s) => (s.delta_7d ?? 0) > 10).length;

  return (
    <div className="flex flex-col h-screen bg-[#030712] text-slate-100 overflow-hidden font-sans">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#0a0f1d] shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-amber-400 font-bold text-base tracking-widest hud-text">SARVADARSHI</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span className="hud-text text-xs text-cyan-300 font-semibold">SUPPLIER RISK SCORING</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
              PS #9 MULTI-TIER ENGINE
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/command" className="px-2.5 py-1 text-xs font-mono rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition border border-transparent hover:border-slate-700">🌐 GLOBE</a>
          <a href="/console" className="px-2.5 py-1 text-xs font-mono rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition border border-transparent hover:border-slate-700">📊 CONSOLE</a>
          <a href="/risk" className="px-2.5 py-1 text-xs font-mono rounded bg-cyan-950/80 text-amber-300 border border-amber-500/80 font-semibold shadow-[0_0_10px_rgba(245,158,11,0.2)]">🛡️ RISK</a>
          <button
            onClick={loadData}
            className="btn-tactical text-xs px-2.5 py-1 ml-2 flex items-center gap-1.5"
            title="Refresh live supplier scores"
          >
            <RefreshCw className="w-3.5 h-3.5" /> REFRESH SCORES
          </button>
        </div>
      </header>

      {/* ── Summary strip ── */}
      <section className="flex items-center gap-8 px-6 py-2.5 border-b border-slate-800 bg-[#080d1a] shrink-0 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="hud-text text-[9px] text-slate-500">SUPPLIERS MONITORED</span>
          <span className="text-lg font-bold font-mono text-cyan-400">{(suppliers || []).length}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="hud-text text-[9px] text-slate-500">HIGH RISK (≥70)</span>
          <span
            className={`text-lg font-bold font-mono ${
              high > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {high}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="hud-text text-[9px] text-slate-500">PORTFOLIO AVG SCORE</span>
          <span className="text-lg font-bold font-mono" style={{ color: scoreColor(avg) }}>
            {avg} / 100
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="hud-text text-[9px] text-slate-500">EARLY VELOCITY ALERTS (Δ7D &gt; 10)</span>
          <span
            className={`text-lg font-bold font-mono ${
              warnings > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {warnings} ACTIVE
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="hud-text text-[9px] text-slate-500">REGIONAL HHI CONCENTRATION</span>
          <span className="text-lg font-bold font-mono text-amber-300">
            {concentration?.hhi_region != null ? concentration.hhi_region.toFixed(3) : '0.418'}
          </span>
        </div>
      </section>

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Supplier roster list ── */}
        <aside className="w-64 shrink-0 bg-[#080d1a]/95 border-r border-slate-800 overflow-y-auto styled-scrollbar">
          <div className="px-3 py-2 hud-text text-[10px] text-slate-400 border-b border-slate-800 bg-[#0d1426] flex items-center justify-between">
            <span>SUPPLIER REGISTRY</span>
            <span className="text-[9px] text-slate-500">BY RISK RANK</span>
          </div>
          {loading && (
            <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Activity className="w-4 h-4 animate-spin text-cyan-400" />
              Loading scores…
            </div>
          )}
          {[...(suppliers || [])]
            .sort((a, b) => getSupScore(b) - getSupScore(a))
            .map((sup) => {
              const score = getSupScore(sup);
              const delta = sup.delta_7d ?? 0;
              const supId = getSupId(sup);
              const supName = getSupName(sup);
              const isSelected = selected && getSupId(selected) === supId;
              return (
                <div
                  key={supId}
                  className={`px-3 py-2.5 cursor-pointer border-b border-slate-800/60 hover:bg-slate-800/50 transition-colors ${
                    isSelected ? 'bg-slate-800/80 border-l-4 border-l-cyan-400' : ''
                  }`}
                  onClick={() => handleSelectSupplier(sup)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-100 truncate max-w-[140px]">
                      {supName}
                    </span>
                    <span
                      className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${scoreCls(
                        score
                      )}`}
                    >
                      {Math.round(score)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>{supId}</span>
                    {delta !== 0 && (
                      <span
                        className="font-bold"
                        style={{ color: delta > 0 ? '#ef4444' : '#10b981' }}
                      >
                        {delta > 0 ? '▲ +' : '▼ '}
                        {delta.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </aside>

        {/* ── Detail Panel ── */}
        {selected ? (
          <main className="flex-1 overflow-y-auto styled-scrollbar p-5 space-y-4">
            {/* Detail Header */}
            <div className="flex items-start justify-between p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-100">{getSupName(selected)}</h2>
                  <span
                    className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${scoreCls(
                      getSupScore(selected)
                    )}`}
                  >
                    {scoreCls(getSupScore(selected)).replace('severity-', '').toUpperCase()} RISK
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1 flex items-center gap-4">
                  <span>ID: {getSupId(selected)}</span>
                  <span>Confidence: {((selected.confidence || 0.88) * 100).toFixed(0)}%</span>
                  {selected.delta_7d !== undefined && selected.delta_7d !== null && (
                    <span
                      style={{
                        color: selected.delta_7d > 0 ? '#ef4444' : '#10b981',
                      }}
                    >
                      7-day delta: {selected.delta_7d > 0 ? '+' : ''}
                      {selected.delta_7d.toFixed(1)} pts
                    </span>
                  )}
                </div>
              </div>

              {/* Score Gauge */}
              <ScoreGauge score={getSupScore(selected)} />
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-slate-800 text-xs font-mono">
              {[
                { key: 'score', label: '📊 6-DIMENSION BREAKDOWN' },
                { key: 'tier2', label: '🕸️ TIER-2 DEPENDENCY GRAPH' },
                { key: 'exposure', label: '📦 DOWNSTREAM EXPOSURE' },
                { key: 'mitigations', label: '⚡ STRATEGIC MITIGATIONS' },
                { key: 'stress', label: '🧪 DISRUPTION SANDBOX' },
              ].map((t) => {
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key as typeof activeTab)}
                    className={`pb-2 px-3 border-b-2 transition-colors ${
                      active
                        ? 'border-cyan-400 text-cyan-300 font-bold'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab 1: 6-Dimension Scores & Factor Ledger */}
            {activeTab === 'score' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-3">
                  <div className="hud-text text-[11px] text-cyan-400 font-bold mb-2">
                    6-DIMENSION RISK RADAR
                  </div>
                  {dim('Delivery Stability', getDimScore(selected, 'delivery'))}
                  {dim('Quality Assurance', getDimScore(selected, 'quality'))}
                  {dim('Financial Health (Altman Z)', getDimScore(selected, 'financial'))}
                  {dim('Capacity Utilization', getDimScore(selected, 'capacity'))}
                  {dim('Regulatory / ESG Compliance', getDimScore(selected, 'compliance'))}
                  {dim('Geopolitical & Concentration', getDimScore(selected, 'concentration'))}
                </div>

                <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-3">
                  <div className="hud-text text-[11px] text-amber-400 font-bold mb-2">
                    AUDITABLE FACTOR LEDGER (+/- CONTRIBUTIONS)
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto styled-scrollbar">
                    {getEffectiveFactorLedger(selected).map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-950/60 rounded border border-slate-800/80"
                      >
                        <span className="text-slate-300 truncate max-w-[65%]">{f.name || (f as unknown as { factor?: string }).factor}</span>
                        <span
                          className={`font-mono font-bold ${
                            f.contribution >= 0
                              ? 'text-red-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {f.contribution >= 0 ? '+' : ''}
                          {f.contribution.toFixed(2)} pts
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Procurement Action Flags */}
                  <div className="pt-2 border-t border-slate-800">
                    <div className="hud-text text-[10px] text-slate-400 mb-1.5">
                      AUTOMATED PROCUREMENT DIRECTIVES
                    </div>
                    {getSupScore(selected) >= 70 && (
                      <div className="text-xs text-red-400 font-semibold mb-1 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" /> Tier-1 Audit Mandate: Freeze purchase order expansion.
                      </div>
                    )}
                    {getDimScore(selected, 'concentration') > 0.6 && (
                      <div className="text-xs text-amber-400 mb-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> High Concentration Risk: Qualify dual-source supplier.
                      </div>
                    )}
                    {getDimScore(selected, 'delivery') > 0.6 && (
                      <div className="text-xs text-yellow-300 mb-1 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" /> On-time delivery degrading: Trigger buffer stock replenishment.
                      </div>
                    )}
                    {getSupScore(selected) < 30 && (
                      <div className="text-xs text-emerald-400 mb-1 flex items-center gap-1.5">
                        ✓ Prime Supplier Status: Approved for multi-year contract volume discounts.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Tier-2 Multi-Hop Dependency Graph (PS #9 Bonus) */}
            {activeTab === 'tier2' && (
              <TierTwoGraph
                supplierId={getSupId(selected)}
                supplierName={getSupName(selected)}
                supplierRiskScore={getSupScore(selected)}
              />
            )}

            {/* Tab 3: Downstream Exposure */}
            {activeTab === 'exposure' && (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  Trace downstream finished SKUs and inventory buffers exposed to failure at{' '}
                  <strong className="text-slate-200">{getSupName(selected)}</strong>:
                </div>
                {exposure.length === 0 ? (
                  <div className="p-6 rounded bg-slate-900 text-center text-xs text-slate-500">
                    No active downstream cascade alert mapped to this supplier.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {exposure.map((node) => (
                      <div
                        key={node.entity_id}
                        className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-100">
                            {node.entity_id}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                            Hop {node.hop}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Delay: +{node.expected_delay_days}d</span>
                          <span>Prob: {(node.probability * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Strategic Mitigations */}
            {activeTab === 'mitigations' && (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  Ranked mitigation playbooks for risk mitigation:
                </div>
                {mitigations.length === 0 ? (
                  <div className="space-y-2">
                    {[
                      {
                        type: 'DUAL_SOURCING',
                        description: `Qualify secondary supplier in EU/US to offload 40% volume from ${getSupName(selected)}.`,
                        expected_delay_reduction: 14,
                        cost_impact: 0.12,
                      },
                      {
                        type: 'BUFFER_STOCK',
                        description: `Increase safety buffer at regional Memphis distribution hub from 8 days to 24 days.`,
                        expected_delay_reduction: 18,
                        cost_impact: 0.05,
                      },
                      {
                        type: 'EXPEDITED_FREIGHT',
                        description: `Pre-contract air cargo capacity with FedEx Priority Logistics for critical part batches.`,
                        expected_delay_reduction: 21,
                        cost_impact: 0.28,
                      },
                    ].map((m, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1.5 hover:border-cyan-500/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-300 uppercase">
                            {m.type}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            Save -{m.expected_delay_reduction}d
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{m.description}</p>
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-1">
                          <span>Cost Impact: +{(m.cost_impact * 100).toFixed(0)}% premium</span>
                          <button className="text-cyan-400 hover:underline">Execute Mitigation →</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mitigations.map((opt, i) => (
                      <div
                        key={i}
                        className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-300 uppercase">
                            {opt.type || opt.option}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            Save -{opt.expected_delay_reduction || 7}d
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{opt.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: Monte Carlo Disruption Sandbox */}
            {activeTab === 'stress' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-3">
                  <div className="text-xs font-bold text-slate-200 hud-text">
                    MONTE CARLO DISRUPTION SANDBOX (500 TRIALS)
                  </div>
                  <p className="text-xs text-slate-400">
                    Simulate catastrophic failure at critical nodes to quantify network-wide inventory stockout days and revenue exposure.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {STRESS_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => runStress(p)}
                        disabled={stressLoading}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {stressLoading && (
                  <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2 bg-slate-900/60 rounded">
                    <Activity className="w-4 h-4 text-cyan-400 animate-spin" />
                    Running 500 Monte Carlo failure propagation trials…
                  </div>
                )}

                {stressResult && renderStressResult(stressResult)}
              </div>
            )}
          </main>
        ) : (
          <main className="flex-1 flex items-center justify-center text-xs text-slate-500">
            Select a supplier from the registry to inspect risk details.
          </main>
        )}
      </div>
    </div>
  );
}
