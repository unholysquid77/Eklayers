'use client';
import { useState, useEffect, useCallback } from 'react';
import type { SupplierRiskScore, ConcentrationResult, StressTestResult, MitigationOption, ExposureNode } from '@/lib/contracts';
import { getSuppliers, getConcentration, runStressTest, getMitigations, getExposure, getAlerts } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(s: number) {
  if (s >= 70) return 'var(--alert-red)';
  if (s >= 45) return '#ffaa00';
  if (s >= 25) return '#ffcc00';
  return 'var(--alert-green)';
}

function scoreCls(s: number) {
  if (s >= 70) return 'severity-critical';
  if (s >= 45) return 'severity-high';
  if (s >= 25) return 'severity-medium';
  return 'severity-low';
}

function dim(label: string, value: number) {
  return (
    <div key={label} className="mb-1.5">
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-[var(--text-muted)] uppercase">{label}</span>
        <span className="font-bold" style={{ color: scoreColor(value * 100) }}>{(value * 100).toFixed(0)}</span>
      </div>
      <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value * 100}%`, background: scoreColor(value * 100) }} />
      </div>
    </div>
  );
}

// Gauge: conic-gradient arc
function ScoreGauge({ score }: { score: number }) {
  const c = scoreColor(score);
  const pct = Math.round(score);
  const deg = Math.round(score * 1.8); // 0–180 degrees
  return (
    <div className="flex flex-col items-center gap-1 py-3">
      <div
        className="w-28 h-14 overflow-hidden relative"
        style={{ borderRadius: '56px 56px 0 0' }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 180deg, ${c} ${deg}deg, var(--bg-tertiary) ${deg}deg)`,
            transform: 'scaleY(0.5)',
            transformOrigin: 'bottom center',
          }}
        />
        <div
          className="absolute inset-2 rounded-full bg-[var(--bg-secondary)]"
          style={{ transform: 'scaleY(0.5)', transformOrigin: 'bottom center' }}
        />
      </div>
      <div className="hud-text text-3xl font-bold" style={{ color: c }}>{pct}</div>
      <div className="text-[10px] text-[var(--text-muted)] uppercase">Risk Score</div>
    </div>
  );
}

// Stress test presets
const STRESS_PRESETS = [
  { label: 'Singapore Port Closure', scenario: 'port_closure', node: 'port-singapore' },
  { label: 'Suez Canal Blockage', scenario: 'route_disruption', node: 'port-said' },
  { label: 'TSMC Taiwan Shutdown', scenario: 'supplier_failure', node: 'sup-beta' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RiskPage() {
  const [suppliers, setSuppliers] = useState<SupplierRiskScore[]>([]);
  const [selected, setSelected] = useState<SupplierRiskScore | null>(null);
  const [concentration, setConcentration] = useState<ConcentrationResult | null>(null);
  const [stressResult, setStressResult] = useState<StressTestResult | null>(null);
  const [mitigations, setMitigations] = useState<MitigationOption[]>([]);
  const [exposure, setExposure] = useState<ExposureNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [stressLoading, setStressLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'score' | 'exposure' | 'mitigations' | 'stress'>('score');

  useEffect(() => {
    Promise.allSettled([
      getSuppliers(),
      getConcentration(),
    ]).then(([s, c]) => {
      if (s.status === 'fulfilled') { setSuppliers(s.value); if (s.value.length) setSelected(s.value[0]); }
      if (c.status === 'fulfilled') setConcentration(c.value);
      setLoading(false);
    });
  }, []);

  const handleSelectSupplier = useCallback(async (sup: SupplierRiskScore) => {
    setSelected(sup);
    setMitigations([]);
    setExposure([]);
    // Load exposure for this supplier
    try {
      // Get first alert referencing this supplier
      const alerts = await getAlerts();
      const alertForSup = alerts.find(a => a.subject_id === sup.supplier_id);
      if (alertForSup) {
        const nodes = await getExposure(alertForSup.id);
        setExposure(nodes.slice(0, 10));
        const mits = await getMitigations(alertForSup.id).catch(() => []);
        setMitigations(mits);
      }
    } catch { /* noop */ }
  }, []);

  const runStress = useCallback(async (preset: typeof STRESS_PRESETS[0]) => {
    setStressLoading(true);
    setStressResult(null);
    try {
      const result = await runStressTest({ scenario: preset.scenario, disrupted_node: preset.node });
      setStressResult(result);
      setActiveTab('stress');
    } catch { /* noop */ } finally { setStressLoading(false); }
  }, []);

  // Derived stats
  const high = suppliers.filter(s => s.composite_score >= 70).length;
  const avg  = suppliers.length ? Math.round(suppliers.reduce((a, s) => a + s.composite_score, 0) / suppliers.length) : 0;
  const warnings = suppliers.filter(s => (s.delta_7d ?? 0) > 10).length;

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-void)] text-[var(--text-primary)] overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[var(--gold-primary)] font-bold text-sm tracking-widest hud-text">SARVADARSHI</span>
          <span className="hud-text text-xs text-[var(--cyan-primary)]">RISK SCORING</span>
          <span className="hud-text text-xs text-[var(--text-muted)]">PS #9 — SUPPLIER RISK ENGINE</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/command" className="px-2.5 py-1 text-xs font-mono rounded text-[var(--text-secondary)] hover:text-[var(--cyan-primary)] hover:bg-[var(--bg-tertiary)] transition border border-transparent hover:border-[var(--border-secondary)]">🌐 GLOBE</a>
          <a href="/console" className="px-2.5 py-1 text-xs font-mono rounded text-[var(--text-secondary)] hover:text-[var(--cyan-primary)] hover:bg-[var(--bg-tertiary)] transition border border-transparent hover:border-[var(--border-secondary)]">📊 CONSOLE</a>
          <a href="/risk" className="px-2.5 py-1 text-xs font-mono rounded bg-[var(--cyan-dim)]/30 text-[var(--cyan-primary)] border border-[var(--border-cyan)] font-semibold">🛡️ RISK</a>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="flex gap-6 px-6 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] shrink-0">
        {[
          { label: 'SUPPLIERS MONITORED', value: suppliers.length, cls: 'text-[var(--cyan-primary)]' },
          { label: 'HIGH RISK (≥70)',      value: high,             cls: high > 0 ? 'text-[var(--alert-red)]' : 'text-[var(--alert-green)]' },
          { label: 'PORTFOLIO AVG SCORE', value: avg,              cls: `font-bold`, style: { color: scoreColor(avg) } },
          { label: 'EARLY WARNINGS',       value: warnings,         cls: warnings > 0 ? 'text-[#ffaa00]' : 'text-[var(--alert-green)]' },
          { label: 'HHI (REGION)',          value: concentration ? concentration.hhi_region.toFixed(3) : '—', cls: 'text-[var(--text-secondary)]' },
        ].map(stat => (
          <div key={stat.label} className="flex flex-col gap-0.5">
            <span className="hud-text text-[9px] text-[var(--text-muted)]">{stat.label}</span>
            <span className={`text-xl font-bold ${stat.cls}`} style={(stat as { style?: React.CSSProperties }).style}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Supplier list ── */}
        <div className="w-60 shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border-primary)] overflow-y-auto styled-scrollbar">
          <div className="px-3 py-2 hud-text text-[10px] text-[var(--text-muted)] border-b border-[var(--border-primary)]">
            SUPPLIERS — sorted by risk
          </div>
          {loading && <div className="p-4 text-center text-xs text-[var(--text-muted)]">Loading…</div>}
          {[...suppliers].sort((a, b) => b.composite_score - a.composite_score).map(sup => {
            const delta = sup.delta_7d ?? 0;
            return (
              <div
                key={sup.supplier_id}
                className={`px-3 py-2.5 cursor-pointer border-b border-[var(--border-primary)]/30 hover:bg-[var(--bg-tertiary)] ${selected?.supplier_id === sup.supplier_id ? 'bg-[var(--bg-tertiary)] border-l-2 border-l-[var(--cyan-primary)]' : ''}`}
                onClick={() => handleSelectSupplier(sup)}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold truncate max-w-[130px]">{sup.supplier_name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scoreCls(sup.composite_score)}`}>{Math.round(sup.composite_score)}</span>
                </div>
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-[var(--text-muted)]">{sup.supplier_id}</span>
                  {delta !== 0 && (
                    <span style={{ color: delta > 0 ? 'var(--alert-red)' : 'var(--alert-green)' }}>
                      {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Detail panel ── */}
        {selected ? (
          <div className="flex-1 overflow-y-auto styled-scrollbar p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xl font-bold">{selected.supplier_name}</div>
                <div className="text-xs text-[var(--text-muted)]">{selected.supplier_id} · as of {new Date(selected.as_of).toLocaleString()}</div>
                {(selected.delta_7d ?? 0) > 10 && (
                  <div className="mt-1 text-xs text-[#ffaa00] font-bold">⚠ EARLY WARNING — Score up {selected.delta_7d?.toFixed(1)} pts in 7 days</div>
                )}
              </div>
              <ScoreGauge score={selected.composite_score} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-[var(--border-primary)]">
              {(['score','exposure','mitigations','stress'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 text-xs hud-text uppercase transition-colors ${activeTab === t ? 'text-[var(--cyan-primary)] border-b-2 border-[var(--cyan-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Score tab */}
            {activeTab === 'score' && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="hud-text text-[10px] text-[var(--text-muted)] mb-2">DIMENSION SCORES</div>
                  {dim('Delivery',      selected.dimension_scores.delivery)}
                  {dim('Quality',       selected.dimension_scores.quality)}
                  {dim('Financial',     selected.dimension_scores.financial)}
                  {dim('Capacity',      selected.dimension_scores.capacity)}
                  {dim('Compliance',    selected.dimension_scores.compliance)}
                  {dim('Concentration', selected.dimension_scores.concentration)}
                </div>
                <div>
                  <div className="hud-text text-[10px] text-[var(--text-muted)] mb-2">FACTOR LEDGER</div>
                  <div className="space-y-1">
                    {selected.factor_ledger.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-[var(--border-primary)]/40">
                        <span className="text-[var(--text-secondary)] truncate max-w-[60%]">{f.factor}</span>
                        <span className={`font-bold ${f.direction === 'positive' ? 'text-[var(--alert-green)]' : f.direction === 'negative' ? 'text-[var(--alert-red)]' : 'text-[var(--text-muted)]'}`}>
                          {f.contribution >= 0 ? '+' : ''}{f.contribution.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Procurement flags */}
                  <div className="mt-4">
                    <div className="hud-text text-[10px] text-[var(--text-muted)] mb-2">PROCUREMENT FLAGS</div>
                    {selected.composite_score >= 70 && (
                      <div className="text-xs text-[var(--alert-red)] mb-1">🔴 Audit triggered — contact sourcing lead</div>
                    )}
                    {selected.dimension_scores.concentration < 0.4 && (
                      <div className="text-xs text-[#ffaa00] mb-1">🟡 Dual-source review needed — high concentration</div>
                    )}
                    {selected.dimension_scores.delivery < 0.7 && (
                      <div className="text-xs text-[#ffcc00] mb-1">🟡 On-time delivery below threshold — expedite review</div>
                    )}
                    {selected.composite_score < 30 && (
                      <div className="text-xs text-[var(--alert-green)] mb-1">🟢 Preferred supplier — eligible for long-term contract</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Exposure tab */}
            {activeTab === 'exposure' && (
              <div>
                <div className="hud-text text-[10px] text-[var(--text-muted)] mb-3">BOM EXPOSURE TREE — Impact if {selected.supplier_name} fails</div>
                {exposure.length === 0 && <div className="text-xs text-[var(--text-muted)]">No exposure data. An active alert is needed to compute BOM traversal.</div>}
                {exposure.map(n => (
                  <div key={n.node_id} className="flex items-center gap-3 py-1.5 border-b border-[var(--border-primary)]/40">
                    <span className="hud-text text-[9px] text-[var(--text-muted)] w-6">{n.depth}↓</span>
                    <span className="text-[11px] flex-1">{n.node_name}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{n.node_kind}</span>
                    <div className="w-20 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${n.exposure_score * 100}%`, background: scoreColor(n.exposure_score * 100) }} />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: scoreColor(n.exposure_score * 100) }}>{(n.exposure_score * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Mitigations tab */}
            {activeTab === 'mitigations' && (
              <div>
                <div className="hud-text text-[10px] text-[var(--text-muted)] mb-3">MITIGATION OPTIONS</div>
                {mitigations.length === 0 && <div className="text-xs text-[var(--text-muted)]">No mitigations computed. Requires an active alert for this supplier.</div>}
                {mitigations.map((m, i) => (
                  <div key={i} className={`glass-panel p-3 mb-2 rounded-lg ${m.recommended ? 'border border-[var(--cyan-primary)]/50' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{m.option}</span>
                      {m.recommended && <span className="text-[9px] text-[var(--cyan-primary)] border border-[var(--cyan-primary)] px-1 rounded">RECOMMENDED</span>}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mb-2">{m.description}</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-[9px] text-[var(--text-muted)]">COST EST.</div>
                        <div className="text-xs font-bold">\${m.cost_estimate.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[var(--text-muted)]">LEAD TIME SAVE</div>
                        <div className="text-xs font-bold text-[var(--alert-green)]">{m.lead_time_reduction_days}d</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[var(--text-muted)]">SCORE DELTA</div>
                        <div className={`text-xs font-bold ${m.risk_score_delta < 0 ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}`}>
                          {m.risk_score_delta >= 0 ? '+' : ''}{m.risk_score_delta.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Stress test tab */}
            {activeTab === 'stress' && (
              <div>
                <div className="hud-text text-[10px] text-[var(--text-muted)] mb-3">STRESS SCENARIOS (500 Monte Carlo trials)</div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {STRESS_PRESETS.map(p => (
                    <button key={p.label} onClick={() => runStress(p)} disabled={stressLoading} className="btn-danger text-xs px-3 py-1.5 disabled:opacity-50">
                      {stressLoading ? '…' : p.label}
                    </button>
                  ))}
                </div>
                {stressResult && (
                  <div className="glass-panel p-4 rounded-lg">
                    <div className="text-sm font-bold mb-3">{stressResult.scenario} — {stressResult.disrupted_node}</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="gotham-stat">
                        <div className="gotham-stat__value" style={{ color: scoreColor(stressResult.mean_exposure * 100) }}>
                          {(stressResult.mean_exposure * 100).toFixed(1)}%
                        </div>
                        <div className="gotham-stat__label">MEAN EXPOSURE</div>
                      </div>
                      <div className="gotham-stat">
                        <div className="gotham-stat__value text-[var(--alert-red)]">
                          {(stressResult.p95_exposure * 100).toFixed(1)}%
                        </div>
                        <div className="gotham-stat__label">P95 EXPOSURE</div>
                      </div>
                      <div className="gotham-stat">
                        <div className="gotham-stat__value">{stressResult.trials}</div>
                        <div className="gotham-stat__label">TRIALS</div>
                      </div>
                      <div className="gotham-stat">
                        <div className="gotham-stat__value text-[var(--alert-red)]">
                          \${(stressResult.revenue_at_risk / 1000).toFixed(0)}K
                        </div>
                        <div className="gotham-stat__label">REVENUE AT RISK</div>
                      </div>
                    </div>
                    {stressResult.affected_skus.length > 0 && (
                      <div className="mt-3">
                        <div className="hud-text text-[9px] text-[var(--text-muted)] mb-1">AFFECTED SKUs</div>
                        <div className="flex flex-wrap gap-1">
                          {stressResult.affected_skus.map(s => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--alert-red)]">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-muted)]">Select a supplier</div>
        )}

        {/* ── Right panel — Concentration ── */}
        <div className="w-64 shrink-0 bg-[var(--bg-secondary)] border-l border-[var(--border-primary)] overflow-y-auto styled-scrollbar p-4">
          <div className="hud-text text-[10px] text-[var(--text-muted)] mb-3">CONCENTRATION RISK</div>
          {concentration ? (
            <>
              <div className={`text-xs font-bold mb-3 px-2 py-1 rounded ${scoreCls(concentration.hhi_region * 100)}`}>
                {concentration.risk_level.toUpperCase()} — HHI {concentration.hhi_region.toFixed(3)}
              </div>
              <div className="mb-4">
                <div className="hud-text text-[9px] text-[var(--text-muted)] mb-1">BY REGION</div>
                {Object.entries(concentration.by_region).map(([r, v]) => (
                  <div key={r} className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] flex-1 truncate">{r}</span>
                    <div className="w-20 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--gold-primary)]" style={{ width: `${v * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{(v * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <div className="hud-text text-[9px] text-[var(--text-muted)] mb-1">BY CATEGORY</div>
                {Object.entries(concentration.by_category).map(([c, v]) => (
                  <div key={c} className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] flex-1 truncate capitalize">{c}</span>
                    <div className="w-20 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--cyan-primary)]" style={{ width: `${v * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{(v * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              <div className="glass-panel p-3 rounded-lg text-xs">
                <div className="text-[var(--text-muted)] mb-1">TOP CONCENTRATION RISK</div>
                <div className="font-bold text-[var(--gold-primary)]">{concentration.top_region}</div>
                <div className="text-[var(--text-muted)]">{concentration.top_category}</div>
              </div>
            </>
          ) : (
            <div className="text-xs text-[var(--text-muted)]">Loading concentration…</div>
          )}
        </div>
      </div>
    </div>
  );
}
