'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Activity, Globe, TrendingUp, AlertTriangle, Shield, Zap, RefreshCw, ChevronRight } from 'lucide-react';
import type { Supplier, SupplierRiskScore, ExposureRow, StressTestResult, ConcentrationInfo } from '@/lib/contracts';
import { getSuppliers, getSupplierRisk, getExposure, runStressTest, getConcentration, getDemoNodes, getDemoDependencies } from '@/lib/api';

export default function RiskPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [riskScore, setRiskScore] = useState<SupplierRiskScore | null>(null);
  const [exposure, setExposure] = useState<ExposureRow[]>([]);
  const [concentration, setConcentration] = useState<ConcentrationInfo | null>(null);
  const [stressResult, setStressResult] = useState<StressTestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [stressLoading, setStressLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [suppliersData, exposureData, concData] = await Promise.all([
        getSuppliers().catch(() => []),
        getExposure().catch(() => []),
        getConcentration().catch(() => null),
      ]);
      setSuppliers(suppliersData);
      setExposure(exposureData);
      setConcentration(concData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectSupplier = async (id: string) => {
    setSelectedSupplier(id);
    const risk = await getSupplierRisk(id).catch(() => null);
    setRiskScore(risk);
  };

  const handleStressTest = async (targetId: string) => {
    setStressLoading(true);
    try {
      const result = await runStressTest({ target_id: targetId, target_kind: 'port', trials: 500, rng_seed: 7, forced_failure: true });
      setStressResult(result);
    } finally {
      setStressLoading(false);
    }
  };

  const handleReset = async () => {
    const { resetDemo } = await import('@/lib/api');
    await resetDemo();
    await loadData();
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-void)' }}>
      {/* Top navigation */}
      <nav className="glass-panel flex items-center justify-between px-6 py-3 mx-4 mt-4 rounded-xl">
        <div className="flex items-center gap-4">
          <Link href="/command" className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <Globe className="w-4 h-4" />
            <span className="hud-text text-[10px]">COMMAND</span>
          </Link>
          <div className="h-4 w-px bg-[var(--border-primary)]" />
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--gold-primary)]" />
            <span className="hud-text text-sm text-[var(--text-primary)]">SUPPLYCHAIN SENTINEL</span>
          </div>
          <div className="h-4 w-px bg-[var(--border-primary)]" />
          <span className="hud-text text-[10px] text-[var(--text-muted)]">RISK DASHBOARD</span>
        </div>
        <button onClick={handleReset} className="btn-tactical text-[10px] py-1.5 px-3">
          <RefreshCw className="w-3 h-3 inline mr-1" />
          RESET
        </button>
      </nav>

      <div className="flex gap-4 p-4" style={{ height: 'calc(100vh - 88px)' }}>
        {/* Left: Supplier list */}
        <div className="w-72 glass-panel flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--gold-primary)]" />
              <span className="hud-text text-[11px] text-[var(--text-primary)]">SUPPLIER RISK</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              {suppliers.length} monitored suppliers
            </p>
          </div>

          <div className="flex-1 overflow-y-auto styled-scrollbar p-3 space-y-2">
            {loading && (
              <div className="text-center py-8 text-[var(--text-muted)] text-[11px] font-mono">Loading...</div>
            )}
            {suppliers.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectSupplier(s.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedSupplier === s.id
                    ? 'border-[var(--gold-primary)] bg-[rgba(var(--gold-rgb),0.08)]'
                    : 'border-[var(--border-secondary)] bg-[var(--bg-secondary)] hover:border-[var(--border-primary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">
                    {s.id.replace('supplier-', '').replace(/-/g, ' ').toUpperCase()}
                  </span>
                  <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                </div>
                <div className="text-[9px] font-mono text-[var(--text-muted)] mt-0.5">
                  {s.country_code} &middot; {s.latitude.toFixed(2)}, {s.longitude.toFixed(2)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Risk detail */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Risk score card */}
          {riskScore && (
            <div className="glass-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[15px] font-mono font-bold text-[var(--text-primary)]">
                    {riskScore.supplier_id.replace('supplier-', '').replace(/-/g, ' ').toUpperCase()}
                  </h2>
                  <p className="text-[10px] font-mono text-[var(--text-muted)]">Supplier Risk Assessment</p>
                </div>
                <div className="gotham-stat">
                  <span
                    className="gotham-stat__value text-3xl"
                    style={{
                      color: riskScore.score_0_100 > 60 ? 'var(--alert-red)' : riskScore.score_0_100 > 35 ? 'var(--alert-orange)' : 'var(--alert-green)',
                    }}
                  >
                    {riskScore.score_0_100.toFixed(0)}
                  </span>
                  <span className="gotham-stat__label">RISK SCORE (0-100)</span>
                </div>
              </div>

              {/* Dimension bars */}
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(riskScore.dimension_scores).map(([key, value]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                        {key.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {(value * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${value * 100}%`,
                          background: value > 0.6 ? 'var(--alert-red)' : value > 0.35 ? 'var(--alert-orange)' : 'var(--alert-green)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Factor ledger */}
              <div className="mt-4 gotham-divider">
                <span className="gotham-divider__label">FACTOR LEDGER</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {riskScore.factor_ledger.slice(0, 6).map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] font-mono px-2 py-1 rounded bg-[var(--bg-secondary)]">
                    <span className="text-[var(--text-secondary)]">{f.factor.split(':')[0]}</span>
                    <span style={{ color: f.contribution > 0 ? 'var(--alert-red)' : 'var(--alert-green)' }}>
                      {f.contribution > 0 ? '+' : ''}{(f.contribution * 100).toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Stress test button */}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleStressTest(riskScore.supplier_id)}
                  disabled={stressLoading}
                  className="btn-tactical text-[10px]"
                >
                  <Zap className="w-3 h-3 inline mr-1" />
                  {stressLoading ? 'RUNNING...' : 'STRESS TEST (FORCED FAILURE)'}
                </button>
              </div>
            </div>
          )}

          {/* Cascade exposure */}
          <div className="glass-panel p-5 flex-1 overflow-y-auto styled-scrollbar">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[var(--alert-orange)]" />
              <span className="hud-text text-[11px] text-[var(--text-primary)]">CASCADE EXPOSURE</span>
              <span className="text-[9px] font-mono text-[var(--text-muted)] ml-auto">
                Monte Carlo (500 trials, seed=7)
              </span>
            </div>

            {stressResult && (
              <div className="mb-4 p-3 rounded-lg border border-[var(--alert-red)]/30 bg-[var(--alert-red)]/5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[var(--alert-red)]" />
                  <span className="text-[11px] font-mono font-bold text-[var(--alert-red)]">STRESS TEST: {stressResult.target_id}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-2">
                  <div className="gotham-stat">
                    <span className="gotham-stat__value text-sm">{stressResult.exposure.length}</span>
                    <span className="gotham-stat__label">NODES AFFECTED</span>
                  </div>
                  <div className="gotham-stat">
                    <span className="gotham-stat__value text-sm">{stressResult.mitigations.length}</span>
                    <span className="gotham-stat__label">MITIGATIONS</span>
                  </div>
                </div>
                {stressResult.mitigations.length > 0 && (
                  <div className="space-y-1">
                    {stressResult.mitigations.map((m, i) => (
                      <div key={i} className="text-[9px] font-mono text-[var(--text-secondary)]">
                        {m.node}: {m.mitigation} (stockout: {m.stockout_days?.toFixed(0) ?? 'N/A'}d)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Exposure table */}
            <table className="w-full">
              <thead>
                <tr className="text-[9px] font-mono text-[var(--text-muted)] border-b border-[var(--border-secondary)]">
                  <th className="text-left py-2 px-2">NODE</th>
                  <th className="text-right py-2 px-2">P(AFFECTED)</th>
                  <th className="text-right py-2 px-2">EXPECTED IMPACT</th>
                  <th className="text-right py-2 px-2">P50 STOCKOUT</th>
                  <th className="text-right py-2 px-2">P95 STOCKOUT</th>
                </tr>
              </thead>
              <tbody>
                {exposure.map((row) => (
                  <tr key={row.node_id} className="border-b border-[var(--border-secondary)] hover:bg-[var(--hover-accent)] transition-colors">
                    <td className="py-2 px-2 text-[10px] font-mono text-[var(--text-primary)]">
                      {row.node_id}
                    </td>
                    <td className="py-2 px-2 text-[10px] font-mono text-right">
                      <span style={{
                        color: row.probability_affected > 0.5 ? 'var(--alert-red)' : row.probability_affected > 0.2 ? 'var(--alert-orange)' : 'var(--alert-green)',
                      }}>
                        {(row.probability_affected * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-[10px] font-mono text-right text-[var(--text-secondary)]">
                      {row.expected_impact.toFixed(4)}
                    </td>
                    <td className="py-2 px-2 text-[10px] font-mono text-right text-[var(--text-secondary)]">
                      {row.p50_stockout_days != null ? `${row.p50_stockout_days.toFixed(1)}d` : '—'}
                    </td>
                    <td className="py-2 px-2 text-[10px] font-mono text-right text-[var(--text-secondary)]">
                      {row.p95_stockout_days != null ? `${row.p95_stockout_days.toFixed(1)}d` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Concentration info */}
        <div className="w-64 glass-panel flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--cyan-primary)]" />
              <span className="hud-text text-[11px] text-[var(--text-primary)]">CONCENTRATION</span>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {concentration ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="gotham-stat">
                    <span className="gotham-stat__value">{concentration.suppliers}</span>
                    <span className="gotham-stat__label">SUPPLIERS</span>
                  </div>
                  <div className="gotham-stat">
                    <span className="gotham-stat__value">{concentration.ports}</span>
                    <span className="gotham-stat__label">PORTS</span>
                  </div>
                  <div className="gotham-stat">
                    <span className="gotham-stat__value">{concentration.lanes}</span>
                    <span className="gotham-stat__label">LANES</span>
                  </div>
                  <div className="gotham-stat">
                    <span className="gotham-stat__value">{concentration.herfindahl_index.toFixed(3)}</span>
                    <span className="gotham-stat__label">HHI</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
                  <div className="text-[10px] font-mono text-[var(--text-muted)] mb-1">SINGLE SOURCE RISK</div>
                  <div
                    className="text-[13px] font-mono font-bold"
                    style={{
                      color: concentration.single_source_risk === 'high' ? 'var(--alert-red)' : 'var(--alert-green)',
                    }}
                  >
                    {concentration.single_source_risk.toUpperCase()}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-[var(--text-muted)] text-[11px] font-mono">
                Loading...
              </div>
            )}

            <div className="gotham-divider">
              <span className="gotham-divider__label">QUICK ACTIONS</span>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleStressTest('port-singapore')}
                disabled={stressLoading}
                className="btn-tactical btn-tactical--cyan text-[10px] w-full"
              >
                <Zap className="w-3 h-3 inline mr-1" />
                STRESS: SINGAPORE
              </button>
              <button
                onClick={() => handleStressTest('suez-canal')}
                disabled={stressLoading}
                className="btn-tactical btn-tactical--cyan text-[10px] w-full"
              >
                <Zap className="w-3 h-3 inline mr-1" />
                STRESS: SUEZ CANAL
              </button>
              <button
                onClick={() => handleStressTest('supplier-tsmc')}
                disabled={stressLoading}
                className="btn-tactical btn-tactical--cyan text-[10px] w-full"
              >
                <Zap className="w-3 h-3 inline mr-1" />
                STRESS: TSMC
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
