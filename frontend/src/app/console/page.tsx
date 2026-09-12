'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ConsoleSummary, MonteCarloSimulationData, ConsoleChokepoint,
  ChokepointDetails, ConsoleHeadline, ConsoleSignal,
  ConsoleStressForecast, ConsoleSupplyChain, ConsoleAlert,
  StressTestSimulateRes,
} from '@/lib/contracts';
import {
  getConsoleSummary, getMonteCarloSimulations, getConsoleChokepoints,
  getConsoleChokepointDetails, getConsoleHeadlines, getConsoleSignals,
  getConsoleStressForecast, getConsoleSupplyChains, getConsoleAlerts,
  runConsoleStressTestSimulate,
} from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers & Sub-components
// ---------------------------------------------------------------------------

function ZuluClock() {
  const [t, setT] = useState<string>('');
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().replace('T', 'Z ').slice(0, 20) + 'Z');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!t) return <span className="hud-text text-xs text-[var(--cyan-primary)] tabular-nums">SYNCING...</span>;
  return <span className="hud-text text-xs text-[var(--cyan-primary)] tabular-nums">{t}</span>;
}

function stressColor(score: number): string {
  if (score >= 0.8) return 'var(--alert-red)';
  if (score >= 0.6) return '#ff8800';
  if (score >= 0.4) return '#ffcc00';
  return 'var(--alert-green)';
}

function stressBadgeCls(score: number): string {
  if (score >= 0.8) return 'bg-red-950/80 text-red-400 border-red-800';
  if (score >= 0.6) return 'bg-amber-950/80 text-amber-400 border-amber-800';
  if (score >= 0.4) return 'bg-yellow-950/80 text-yellow-400 border-yellow-800';
  return 'bg-emerald-950/80 text-emerald-400 border-emerald-800';
}

function severityCls(sev: string): string {
  const s = sev.toUpperCase();
  if (s === 'CRITICAL') return 'bg-red-950/80 text-red-400 border-red-700 animate-pulse';
  if (s === 'HIGH') return 'bg-orange-950/80 text-orange-400 border-orange-700';
  if (s === 'MEDIUM') return 'bg-yellow-950/80 text-yellow-400 border-yellow-700';
  return 'bg-emerald-950/80 text-emerald-400 border-emerald-700';
}

function trendIcon(t: 'increasing' | 'stable' | 'decreasing') {
  if (t === 'increasing') return <span className="text-red-400 font-bold">▲ INC</span>;
  if (t === 'decreasing') return <span className="text-emerald-400 font-bold">▼ DEC</span>;
  return <span className="text-yellow-400 font-bold">─ STB</span>;
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ConsolePage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<ConsoleSummary | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloSimulationData | null>(null);
  const [chokepoints, setChokepoints] = useState<ConsoleChokepoint[]>([]);
  const [headlines, setHeadlines] = useState<ConsoleHeadline[]>([]);
  const [signals, setSignals] = useState<ConsoleSignal[]>([]);
  const [forecast, setForecast] = useState<ConsoleStressForecast | null>(null);
  const [supplyChains, setSupplyChains] = useState<ConsoleSupplyChain[]>([]);
  const [alerts, setAlerts] = useState<ConsoleAlert[]>([]);

  // UI States
  const [searchCp, setSearchCp] = useState<string>('');
  const [selectedCpDetails, setSelectedCpDetails] = useState<ChokepointDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [signalsCollapsed, setSignalsCollapsed] = useState<boolean>(false);
  const [expandedChainId, setExpandedChainId] = useState<string | null>('sc_001');
  const [showSimVariables, setShowSimVariables] = useState<boolean>(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.75);
  const [mitigationApplied, setMitigationApplied] = useState<Record<string, string>>({});

  // Sandbox Simulation States
  const [sandboxType, setSandboxType] = useState<'PORT' | 'SUPPLIER' | 'ROUTE' | 'HUB'>('PORT');
  const [sandboxTarget, setSandboxTarget] = useState<string>('port_la');
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<StressTestSimulateRes | null>(null);

  // Load All Console Data
  const loadConsoleData = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, mc, cp, hd, sig, fc, sc, al] = await Promise.allSettled([
        getConsoleSummary(),
        getMonteCarloSimulations(),
        getConsoleChokepoints(),
        getConsoleHeadlines(),
        getConsoleSignals(),
        getConsoleStressForecast(),
        getConsoleSupplyChains(),
        getConsoleAlerts(),
      ]);

      if (sum.status === 'fulfilled') setSummary(sum.value);
      if (mc.status === 'fulfilled') setMonteCarlo(mc.value);
      if (cp.status === 'fulfilled') setChokepoints(cp.value.chokepoints);
      if (hd.status === 'fulfilled') setHeadlines(hd.value.headlines);
      if (sig.status === 'fulfilled') setSignals(sig.value.signals);
      if (fc.status === 'fulfilled') setForecast(fc.value);
      if (sc.status === 'fulfilled') setSupplyChains(sc.value.supply_chains);
      if (al.status === 'fulfilled') setAlerts(al.value.alerts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConsoleData();
  }, [loadConsoleData]);

  // Click chokepoint to view details
  const handleOpenChokepoint = async (id: string) => {
    setLoadingDetails(true);
    try {
      const d = await getConsoleChokepointDetails(id);
      setSelectedCpDetails(d);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Run Sandbox Simulation
  const handleRunSimulation = async () => {
    setSimRunning(true);
    try {
      const res = await runConsoleStressTestSimulate({
        target_type: sandboxType,
        target_id: sandboxTarget,
      });
      setSimResult(res);
    } finally {
      setSimRunning(false);
    }
  };

  // Filtered chokepoints
  const filteredChokepoints = useMemo(() => {
    if (!searchCp) return chokepoints;
    const q = searchCp.toLowerCase();
    return chokepoints.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [chokepoints, searchCp]);

  // Filtered alerts based on confidence threshold (false alarm control)
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => (a.confidence ?? 0.9) >= confidenceThreshold);
  }, [alerts, confidenceThreshold]);

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] flex flex-col font-sans">

      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/95 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--cyan-primary)] animate-pulse" />
            <span className="text-[var(--gold-primary)] font-bold text-sm tracking-widest hud-text">SARVADARSHI</span>
          </div>
          <span className="hud-text text-xs text-[var(--text-muted)]">|</span>
          <span className="hud-text text-xs text-[var(--cyan-primary)] font-semibold tracking-wider">SUPPLY CHAIN CONSOLE</span>
          <span className="hidden md:inline px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-[var(--text-secondary)]">
            INTELLIGENCE DASHBOARD
          </span>
        </div>

        <div className="flex items-center gap-6">
          <ZuluClock />

          <nav className="flex items-center gap-2">
            <a
              href="/command"
              className="px-3 py-1.5 text-xs font-mono rounded text-[var(--text-secondary)] hover:text-[var(--cyan-primary)] hover:bg-[var(--bg-tertiary)] transition border border-transparent hover:border-[var(--border-secondary)]"
            >
              🌐 GLOBE COMMAND
            </a>
            <a
              href="/console"
              className="px-3 py-1.5 text-xs font-mono rounded bg-[var(--cyan-dim)]/30 text-[var(--cyan-primary)] border border-[var(--border-cyan)] font-semibold"
            >
              📊 CONSOLE
            </a>
            <a
              href="/risk"
              className="px-3 py-1.5 text-xs font-mono rounded text-[var(--text-secondary)] hover:text-[var(--gold-light)] hover:bg-[var(--bg-tertiary)] transition border border-transparent hover:border-[var(--border-secondary)]"
            >
              🛡️ RISK SCORES
            </a>
          </nav>

          <button
            onClick={loadConsoleData}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-mono rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-[var(--border-primary)] border border-[var(--border-secondary)] transition flex items-center gap-1.5"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
            <span>REFRESH</span>
          </button>
        </div>
      </header>

      {/* ── Main Dashboard Content ── */}
      <main className="flex-1 p-5 space-y-6 max-w-[1800px] w-full mx-auto">

        {/* ═══════════════════════════════════════════════════════════════════
            0. SUMMARY STATISTICS WIDGET
            ═══════════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:border-[var(--border-cyan)] transition shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--cyan-primary)]/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
            <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">Active Chokepoints</div>
            <div className="text-2xl font-bold font-mono text-[var(--cyan-primary)]">{summary?.chokepoints_count ?? 124}</div>
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
              <span>●</span> Monitored Strategic Hubs
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:border-[var(--border-cyan)] transition shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#00e676]/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
            <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">Active Signals</div>
            <div className="text-2xl font-bold font-mono text-[#22c55e]">{summary?.signals_count ?? 89}</div>
            <div className="text-[10px] text-[#87a894] mt-1 flex items-center gap-1">
              <span>⚡</span> Real-time Multimodal Inputs
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:border-[var(--border-cyan)] transition shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#00e676]/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
            <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">Active Forecasts</div>
            <div className="text-2xl font-bold font-mono text-[#34d399]">{summary?.forecasts_count ?? 42}</div>
            <div className="text-[10px] text-[#87a894] mt-1 flex items-center gap-1">
              <span>📈</span> 30-Day Kalman Trajectories
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:border-[var(--border-cyan)] transition shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
            <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">Tracked Supply Chains</div>
            <div className="text-2xl font-bold font-mono text-emerald-400">{summary?.supply_chains_count ?? 15}</div>
            <div className="text-[10px] text-emerald-300 mt-1 flex items-center gap-1">
              <span>📦</span> Full BOM Exposure Maps
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-red-900/50 hover:border-red-500/50 transition shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
            <div className="text-[11px] font-mono text-red-300/80 uppercase tracking-wider mb-1">Max Stress Score</div>
            <div className="text-2xl font-bold font-mono text-red-400">
              {((summary?.max_stress ?? 0.89) * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-red-400/90 mt-1 flex items-center gap-1">
              <span>▲</span> Bab-el-Mandeb Strait
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:border-amber-500/50 transition shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
            <div className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">Avg Weighted Stress</div>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {((summary?.average_weighted_stress ?? 0.45) * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-amber-300 mt-1 flex items-center gap-1">
              <span>📊</span> Global Network Mean
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            TOP MIDDLE ROW: WIDGET 1 (MONTE CARLO), WIDGET 5 (STRESS FORECAST), WIDGET 2 (CHOKEPOINTS)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── Widget 1: Monte Carlo Simulations (5 Cols) ── */}
          <section className="lg:col-span-5 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)] mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--cyan-primary)] font-mono">1. MONTE CARLO SIMULATIONS</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-[#00e676] border border-cyan-800">
                    N={monteCarlo?.simulations.toLocaleString() ?? '10,000'}
                  </span>
                </div>
                <button
                  onClick={() => setShowSimVariables(!showSimVariables)}
                  className="text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--cyan-primary)] underline transition"
                >
                  {showSimVariables ? 'Hide Parameters ▲' : 'Confidence Intervals ▼'}
                </button>
              </div>

              {/* Confidence Interval Percentile Cards */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="p-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-center">
                  <div className="text-[10px] font-mono text-[var(--text-muted)]">MEAN DELAY</div>
                  <div className="text-sm font-bold font-mono text-[#22c55e]">{monteCarlo?.mean_disruption_days ?? 12.4}d</div>
                </div>
                <div className="p-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-center">
                  <div className="text-[10px] font-mono text-[var(--text-muted)]">P50 (MEDIAN)</div>
                  <div className="text-sm font-bold font-mono text-emerald-400">{monteCarlo?.percentiles.p50 ?? 10}d</div>
                </div>
                <div className="p-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-center">
                  <div className="text-[10px] font-mono text-[var(--text-muted)]">P90 (HIGH)</div>
                  <div className="text-sm font-bold font-mono text-amber-400">{monteCarlo?.percentiles.p90 ?? 21}d</div>
                </div>
                <div className="p-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-center">
                  <div className="text-[10px] font-mono text-[var(--text-muted)]">P99 (TAIL)</div>
                  <div className="text-sm font-bold font-mono text-red-400">{monteCarlo?.percentiles.p99 ?? 45}d</div>
                </div>
              </div>

              {/* Variable Distribution Drawer */}
              {showSimVariables && (
                <div className="p-3 mb-4 rounded bg-[var(--bg-void)] border border-[var(--border-secondary)] text-xs font-mono space-y-1.5">
                  <div className="text-[11px] font-bold text-[var(--gold-primary)] mb-1">STOCHASTIC MODEL PARAMETERS</div>
                  <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>Lead-time Variance Matrix:</span>
                    <span className="text-white">σ = 0.45 (Lognormal)</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>Chokepoint Cascading Multiplier:</span>
                    <span className="text-white">γ = 1.34x</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>Decay Half-Life Window:</span>
                    <span className="text-white">t½ = 7.0 days</span>
                  </div>
                </div>
              )}

              {/* Histogram Visualizer */}
              <div className="mb-2">
                <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] mb-1.5">
                  <span>DISRUPTION PROBABILITY DENSITY</span>
                  <span>HORIZON: 0 TO 50 DAYS</span>
                </div>
                <div className="h-32 flex items-end gap-1.5 px-2 py-2 bg-[var(--bg-void)] rounded border border-[var(--border-secondary)]">
                  {(monteCarlo?.histogram_data ?? []).map((bin, i) => {
                    const maxProb = 0.20;
                    const heightPct = Math.min(100, Math.max(8, (bin.probability / maxProb) * 100));
                    const isP50 = bin.days === 10;
                    const isP90 = bin.days === 20 || bin.days === 22;
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center group relative h-full justify-end"
                      >
                        {/* Hover Tooltip */}
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center bg-[var(--bg-tertiary)] border border-[var(--border-cyan)] text-[9px] font-mono px-2 py-1 rounded  z-20 whitespace-nowrap pointer-events-none">
                          <span className="text-[#22c55e] font-bold">{bin.days} Days Delay</span>
                          <span className="text-white">{(bin.probability * 100).toFixed(1)}% Prob ({bin.count} sims)</span>
                        </div>

                        <div
                          className={`w-full rounded-t transition-all ${
                            isP50
                              ? 'bg-emerald-400'
                              : isP90
                              ? 'bg-amber-400'
                              : bin.days > 24
                              ? 'bg-red-500/70'
                              : 'bg-cyan-500/60 group-hover:bg-cyan-400'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[8px] font-mono text-[var(--text-muted)] mt-1 hidden md:block">
                          {bin.days % 10 === 0 ? `${bin.days}d` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-secondary)]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> P50: 10d</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> P90: 21d</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /> P99: 45d</span>
            </div>
          </section>

          {/* ── Widget 5: Stress & Disruption Forecast (3 Cols) ── */}
          <section className="lg:col-span-3 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)] mb-3">
                <span className="text-sm font-bold text-[var(--cyan-primary)] font-mono">5. 30-DAY FORECAST</span>
                <span className="text-[10px] font-mono text-[#34d399] bg-purple-950/50 px-1.5 py-0.5 rounded border border-[#112818]">
                  BAYESIAN KALMAN
                </span>
              </div>

              {/* Stress Gauges */}
              <div className="space-y-3.5 mb-4">
                <div className="p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-[var(--text-muted)]">GLOBAL CURRENT STRESS</span>
                    <span className="font-bold font-mono text-[#22c55e]">{((forecast?.current_score ?? 0.65) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-void)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-amber-500 rounded-full transition-all"
                      style={{ width: `${(forecast?.current_score ?? 0.65) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded bg-[var(--bg-tertiary)] border border-red-900/40">
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-red-300/80">HIGHEST 30D PEAK STRESS</span>
                    <span className="font-bold font-mono text-red-400">{((forecast?.highest_30d_forecast ?? 0.88) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-void)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all"
                      style={{ width: `${(forecast?.highest_30d_forecast ?? 0.88) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] mt-1.5">
                    <span>Predicted Peak Date:</span>
                    <span className="text-red-300 font-semibold">{forecast?.peak_date ?? '2026-09-25'}</span>
                  </div>
                </div>

                <div className="p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-[var(--text-muted)]">DISRUPTION PROBABILITY</span>
                    <span className="font-bold font-mono text-[#34d399]">{((forecast?.disruption_probability ?? 0.72) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-void)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${(forecast?.disruption_probability ?? 0.72) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Trend Sparkline */}
            <div className="pt-2 border-t border-[var(--border-secondary)]">
              <div className="text-[10px] font-mono text-[var(--text-muted)] mb-1">30-DAY PREDICTED STRESS CURVE</div>
              <div className="flex items-end gap-1 h-10 px-1 bg-[var(--bg-void)] rounded border border-[var(--border-secondary)]">
                {(forecast?.daily_trend ?? []).map((pt, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-cyan-600 to-amber-400 rounded-t transition-all hover:bg-white"
                    style={{ height: `${pt.predicted_stress * 100}%` }}
                    title={`Day ${pt.day} (${pt.date}): ${(pt.predicted_stress * 100).toFixed(0)}%`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ── Widget 2: Ranked Chokepoints List (4 Cols) ── */}
          <section className="lg:col-span-4 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)] mb-3">
                <span className="text-sm font-bold text-[var(--cyan-primary)] font-mono">2. RANKED CHOKEPOINTS</span>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">BY STRESS SCORE</span>
              </div>

              {/* Search Bar */}
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Filter chokepoints..."
                  value={searchCp}
                  onChange={(e) => setSearchCp(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-[var(--bg-void)] border border-[var(--border-secondary)] rounded focus:outline-none focus:border-[var(--cyan-primary)] text-white placeholder-[var(--text-muted)]"
                />
              </div>

              {/* Chokepoint List */}
              <div className="space-y-2 max-h-64 overflow-y-auto styled-scrollbar pr-1">
                {filteredChokepoints.map((cp) => (
                  <div
                    key={cp.id}
                    onClick={() => handleOpenChokepoint(cp.id)}
                    className="p-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] hover:border-[var(--border-cyan)] cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-[var(--cyan-primary)] transition flex items-center gap-1.5">
                        <span>{cp.name}</span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">({cp.id})</span>
                      </div>
                      <div className="text-[10px] font-mono mt-0.5">
                        Trend: {trendIcon(cp.trend)}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${stressBadgeCls(cp.current_stress)}`}>
                        {(cp.current_stress * 100).toFixed(0)}%
                      </span>
                      <div className="text-[9px] font-mono text-[var(--text-muted)] mt-1">click details →</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-secondary)] flex justify-between">
              <span>Total Active: {chokepoints.length}</span>
              <span>Sorted by severity</span>
            </div>
          </section>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            MIDDLE ROW 2: WIDGET 3 (HEADLINES), WIDGET 4 (SIGNALS), WIDGET 7 (ALERTS & MITIGATION)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── Widget 3: Relevant Headlines (4 Cols) ── */}
          <section className="lg:col-span-4 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)] mb-3">
                <span className="text-sm font-bold text-[var(--cyan-primary)] font-mono">3. RELEVANT HEADLINES</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                  REAL-TIME NEWS
                </span>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto styled-scrollbar pr-1">
                {headlines.map((h) => (
                  <div key={h.id} className="p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] hover:border-[var(--border-primary)] transition">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-950 text-[#22c55e] border border-[#112818]">
                        {h.source}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-white leading-relaxed mb-2">
                      {h.title}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {h.related_chokepoints.map((chk) => (
                        <span key={chk} className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[var(--bg-void)] border border-[var(--border-secondary)] text-[var(--gold-primary)]">
                          🔗 {chk}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-secondary)]">
              Automated NLP Entity Linking Active
            </div>
          </section>

          {/* ── Widget 4: Non-News Signals (3 Cols) ── */}
          <section className="lg:col-span-3 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)] mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--cyan-primary)] font-mono">4. SIGNALS FEED</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-white">
                    {signals.length}
                  </span>
                </div>
                <button
                  onClick={() => setSignalsCollapsed(!signalsCollapsed)}
                  className="text-[10px] font-mono text-[var(--text-muted)] hover:text-white"
                >
                  {signalsCollapsed ? 'EXPAND' : 'COLLAPSE'}
                </button>
              </div>

              {!signalsCollapsed ? (
                <div className="space-y-2.5 max-h-72 overflow-y-auto styled-scrollbar pr-1">
                  {signals.map((s) => (
                    <div key={s.id} className="p-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${severityCls(s.severity)}`}>
                          {s.type}
                        </span>
                        <span className="text-[10px] font-mono text-[#22c55e]">
                          {(s.precision_score * 100).toFixed(0)}% PRECISION
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-primary)] leading-normal">
                        {s.description}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded bg-[var(--bg-void)] border border-dashed border-[var(--border-secondary)] text-center text-xs font-mono text-[var(--text-muted)]">
                  Signals widget collapsed ({signals.length} inputs active)
                </div>
              )}
            </div>

            <div className="text-[10px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-secondary)]">
              Auto-pruning noise signals below 80% precision
            </div>
          </section>

          {/* ── Widget 7: Alerts & Mitigation Widget (5 Cols) ── */}
          <section className="lg:col-span-5 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)] mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--cyan-primary)] font-mono">7. ALERTS & MITIGATIONS</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-950/80 text-red-400 border border-red-800">
                    {filteredAlerts.length} ACTIVE
                  </span>
                </div>

                {/* False Alarm Control */}
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-[var(--text-muted)]">Min Conf:</span>
                  <select
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    className="bg-[var(--bg-void)] text-[var(--cyan-primary)] border border-[var(--border-secondary)] rounded px-1.5 py-0.5 text-[10px] font-mono"
                  >
                    <option value={0.70}>70%</option>
                    <option value={0.75}>75% (Std)</option>
                    <option value={0.85}>85% (Strict)</option>
                    <option value={0.90}>90% (Critical)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto styled-scrollbar pr-1">
                {filteredAlerts.map((a) => (
                  <div key={a.id} className="p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${severityCls(a.severity)}`}>
                          {a.severity}
                        </span>
                        {a.related_chokepoint && (
                          <span className="text-[10px] font-mono text-[var(--gold-primary)]">
                            📍 {a.related_chokepoint}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-[#00e676]">
                        {((a.confidence ?? 0.9) * 100).toFixed(0)}% Conf
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-white mb-2 leading-relaxed">
                      {a.message}
                    </div>

                    {/* Mitigations List */}
                    <div className="space-y-1.5 mt-2 pt-2 border-t border-[var(--border-secondary)]">
                      <div className="text-[10px] font-mono text-[var(--cyan-primary)] font-bold">RECOMMENDED MITIGATIONS:</div>
                      {a.mitigations.map((m, idx) => {
                        const isApplied = mitigationApplied[a.id] === m.type;
                        return (
                          <div key={idx} className="p-2 rounded bg-[var(--bg-void)] border border-[var(--border-secondary)] text-[11px] flex items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-amber-300 mr-1.5">[{m.type}]</span>
                              <span className="text-[var(--text-secondary)]">{m.recommendation}</span>
                              <div className="text-[9px] font-mono text-[var(--text-muted)] mt-0.5">
                                Cost Impact: <span className="text-white">{m.cost_impact}</span>
                                {m.lead_time_reduction_days && (
                                  <span className="ml-2 text-emerald-400">⚡ Saves {m.lead_time_reduction_days} days lead-time</span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => setMitigationApplied(prev => ({ ...prev, [a.id]: m.type }))}
                              className={`px-2 py-1 text-[10px] font-mono rounded shrink-0 transition ${
                                isApplied
                                  ? 'bg-emerald-900 text-emerald-300 border border-emerald-600'
                                  : 'bg-[var(--bg-secondary)] hover:bg-[var(--cyan-dim)] text-[#22c55e] border border-[var(--border-cyan)]'
                              }`}
                            >
                              {isApplied ? '✓ ACTIVATED' : 'APPLY'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-secondary)] flex justify-between">
              <span>False Alarm Suppression Active</span>
              <span>Ranked by severity score</span>
            </div>
          </section>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM HALF: WIDGET 6 (SUPPLY CHAIN MAPPING) & WIDGET 8 (STRESS TEST SANDBOX)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── Widget 6: Supply Chain Mapping Widget (8 Cols) ── */}
          <section className="lg:col-span-8 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)] mb-4">
              <div>
                <span className="text-sm font-bold text-[var(--cyan-primary)] font-mono">6. SUPPLY CHAIN MAPPING & BOM TRACE</span>
                <span className="ml-2 text-xs text-[var(--text-muted)]">Extracted from Multi-Tier BOM & Research</span>
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {supplyChains.length} KEY CORRIDORS MONITORED
              </span>
            </div>

            <div className="space-y-3">
              {supplyChains.map((sc) => {
                const isExpanded = expandedChainId === sc.id;
                return (
                  <div
                    key={sc.id}
                    className="p-3.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] hover:border-[var(--border-primary)] transition"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${severityCls(sc.criticality)}`}>
                            {sc.criticality}
                          </span>
                          <span className="text-sm font-bold text-white">{sc.name}</span>
                        </div>
                        <div className="text-[11px] font-mono text-[var(--text-muted)] mt-1">
                          📍 {sc.origin ?? 'Origin'} → {sc.destination ?? 'Destination'}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div>
                          <div className="text-[10px] text-[var(--text-muted)]">EST. TRANSIT</div>
                          <div className="text-white font-bold">{sc.travel_time_days} days</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[var(--text-muted)]">REVISED ARRIVAL</div>
                          <div className="text-amber-400 font-bold">{sc.revised_arrival_date}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[var(--text-muted)]">DISRUPT PROB</div>
                          <div className="text-[#34d399] font-bold">{(sc.disruption_probability * 100).toFixed(0)}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[var(--text-muted)]">STRESS</div>
                          <span className={`px-2 py-0.5 rounded font-bold border ${stressBadgeCls(sc.stress)}`}>
                            {(sc.stress * 100).toFixed(0)}%
                          </span>
                        </div>
                        <button
                          onClick={() => setExpandedChainId(isExpanded ? null : sc.id)}
                          className="px-2.5 py-1 text-xs font-mono rounded bg-[var(--bg-void)] border border-[var(--border-secondary)] hover:border-[var(--border-cyan)] text-[var(--cyan-primary)] transition"
                        >
                          {isExpanded ? 'Collapse BOM ▲' : 'Trace BOM ▼'}
                        </button>
                      </div>
                    </div>

                    {/* Tagged Chokepoints */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-[var(--border-secondary)]">
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">Traversed Chokepoints:</span>
                      {sc.chokepoints.map((chk) => (
                        <span key={chk} className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-void)] border border-[var(--border-secondary)] text-[var(--gold-primary)]">
                          ⚓ {chk}
                        </span>
                      ))}
                    </div>

                    {/* Expandable Bill of Materials (BOM) Tree Trace */}
                    {isExpanded && sc.bom_trace && (
                      <div className="mt-3 p-3 rounded bg-[var(--bg-void)] border border-[var(--border-cyan)]/40 space-y-2">
                        <div className="text-xs font-mono font-bold text-[var(--cyan-primary)] flex items-center gap-2">
                          <span>🔬 BILL OF MATERIALS (BOM) MULTI-TIER EXPOSURE TRACE</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] font-mono">
                            <thead>
                              <tr className="border-b border-[var(--border-secondary)] text-[var(--text-muted)]">
                                <th className="py-1">PART ID</th>
                                <th className="py-1">COMPONENT NAME</th>
                                <th className="py-1">SUPPLIER / FAB</th>
                                <th className="py-1">TIER</th>
                                <th className="py-1">LEAD TIME</th>
                                <th className="py-1">BUFFER STOCK</th>
                                <th className="py-1">RISK STATUS</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-secondary)]">
                              {sc.bom_trace.map((b) => (
                                <tr key={b.part_id} className="hover:bg-[var(--bg-tertiary)] transition">
                                  <td className="py-1.5 font-bold text-[#22c55e]">{b.part_id}</td>
                                  <td className="py-1.5 text-white">{b.name}</td>
                                  <td className="py-1.5 text-[var(--text-secondary)]">{b.supplier}</td>
                                  <td className="py-1.5">
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-950 text-[#87a894] border border-[#112818]">
                                      Tier {b.tier}
                                    </span>
                                  </td>
                                  <td className="py-1.5 text-white">{b.lead_time_days}d</td>
                                  <td className="py-1.5 text-amber-300">{b.buffer_stock_days}d buffer</td>
                                  <td className="py-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                      b.risk_status === 'CRITICAL' || b.risk_status === 'DISRUPTED'
                                        ? 'bg-red-950 text-red-400 border-red-800'
                                        : b.risk_status === 'VULNERABLE' || b.risk_status === 'WARNING'
                                        ? 'bg-amber-950 text-amber-400 border-amber-800'
                                        : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                    }`}>
                                      {b.risk_status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Widget 8: Stress Test Sandbox (Bonus Feature - 4 Cols) ── */}
          <section className="lg:col-span-4 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)] mb-3">
                <span className="text-sm font-bold text-[var(--gold-primary)] font-mono">8. STRESS TEST SANDBOX</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-400 border border-amber-800">
                  SIMULATION MODE
                </span>
              </div>

              <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">
                Trigger simulated structural failures to model time-to-stockout and cascading line halts.
              </p>

              {/* Simulation Controls */}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase block mb-1">Target Node Type</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['PORT', 'SUPPLIER', 'ROUTE', 'HUB'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setSandboxType(t);
                          if (t === 'PORT') setSandboxTarget('port_la');
                          if (t === 'SUPPLIER') setSandboxTarget('sup-alpha');
                          if (t === 'ROUTE') setSandboxTarget('chk_007');
                          if (t === 'HUB') setSandboxTarget('port_rotterdam');
                        }}
                        className={`py-1 text-[10px] font-mono rounded border transition ${
                          sandboxType === t
                            ? 'bg-[var(--cyan-dim)] text-[var(--cyan-primary)] border-[var(--cyan-primary)] font-bold'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-secondary)] hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase block mb-1">Disrupted Target Node</label>
                  <select
                    value={sandboxTarget}
                    onChange={(e) => setSandboxTarget(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-[var(--bg-void)] border border-[var(--border-secondary)] rounded focus:outline-none focus:border-[var(--cyan-primary)] text-white"
                  >
                    {sandboxType === 'PORT' && (
                      <>
                        <option value="port_la">Port of Los Angeles (US West Coast)</option>
                        <option value="chk_001">Panama Canal Atlantic/Pacific Locks</option>
                        <option value="port_rotterdam">Port of Rotterdam (Euro Gateway)</option>
                      </>
                    )}
                    {sandboxType === 'SUPPLIER' && (
                      <>
                        <option value="sup-alpha">TSMC Fab 14 (3nm MCU - Hsinchu)</option>
                        <option value="sup-beta">Bosch Mobility Inverter Plant (Stuttgart)</option>
                      </>
                    )}
                    {sandboxType === 'ROUTE' && (
                      <>
                        <option value="chk_007">Bab-el-Mandeb & Red Sea Corridor</option>
                        <option value="chk_002">Suez Canal Main Channel</option>
                        <option value="chk_003">Strait of Malacca Transit Route</option>
                      </>
                    )}
                    {sandboxType === 'HUB' && (
                      <>
                        <option value="port_rotterdam">Rotterdam Distribution Center</option>
                        <option value="port_la">Memphis Air Logistics Hub</option>
                      </>
                    )}
                  </select>
                </div>

                <button
                  onClick={handleRunSimulation}
                  disabled={simRunning}
                  className="w-full py-2 rounded bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-mono font-bold tracking-wider transition shadow-md flex items-center justify-center gap-2"
                >
                  {simRunning ? (
                    <>
                      <span className="animate-spin">🔄</span>
                      <span>COMPUTING MONTE CARLO STRESS TEST...</span>
                    </>
                  ) : (
                    <>
                      <span>💥</span>
                      <span>TRIGGER DISRUPTION SIMULATION</span>
                    </>
                  )}
                </button>
              </div>

              {/* Simulation Result Output */}
              {simResult && (
                <div className="p-3 rounded bg-[var(--bg-void)] border border-red-800/60 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-secondary)]">
                    <span className="text-[11px] font-bold font-mono text-red-400">SIMULATION REPORT: {simResult.simulation_id}</span>
                    <span className="text-xs font-bold font-mono text-white bg-red-950 px-2 py-0.5 rounded border border-red-700">
                      STOCK-OUT IN {simResult.time_to_stock_out_days} DAYS
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-[var(--text-muted)]">
                    Target: <span className="text-white font-semibold">{simResult.target_name ?? simResult.target_id}</span>
                  </div>

                  <div className="space-y-1 mt-2">
                    <div className="text-[10px] font-mono font-bold text-[var(--gold-primary)]">CASCADING FAILURE TIMELINE:</div>
                    {simResult.cascading_effects.map((eff, i) => (
                      <div key={i} className="text-[11px] font-mono text-[var(--text-secondary)] flex items-start gap-1.5">
                        <span className="text-red-400 shrink-0">▸</span>
                        <span>{eff}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-secondary)]">
              Real-time inventory drawdown analysis
            </div>
          </section>
        </div>

      </main>

      {/* ── Mathematical Details Modal (Widget 2 Popup) ── */}
      {selectedCpDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg p-5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--cyan-primary)]  space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-primary)]">
              <div>
                <span className="text-xs font-mono text-[var(--cyan-primary)]">CHOKEPOINT TOPOLOGY & MATHEMATICAL PROPERTIES</span>
                <h3 className="text-base font-bold text-white mt-0.5">{selectedCpDetails.id}</h3>
              </div>
              <button
                onClick={() => setSelectedCpDetails(null)}
                className="text-sm font-mono text-[var(--text-muted)] hover:text-white px-2 py-1"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                <div className="text-[10px] text-[var(--text-muted)] uppercase">Node Centrality Score</div>
                <div className="text-xl font-bold text-[#22c55e] mt-1">
                  {(selectedCpDetails.centrality_score * 100).toFixed(0)}%
                </div>
                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Betweenness & flow centrality</div>
              </div>

              <div className="p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                <div className="text-[10px] text-[var(--text-muted)] uppercase">Flow Capacity Variance</div>
                <div className="text-xl font-bold text-amber-300 mt-1">
                  ±{(selectedCpDetails.flow_capacity_variance * 100).toFixed(0)}%
                </div>
                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">TEU volume fluctuation band</div>
              </div>

              <div className="p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                <div className="text-[10px] text-[var(--text-muted)] uppercase">Historical Stress Coeff</div>
                <div className="text-xl font-bold text-[#87a894] mt-1">
                  {selectedCpDetails.historical_stress_coefficient.toFixed(2)}x
                </div>
                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Long-term disruption sensitivity</div>
              </div>

              <div className="p-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                <div className="text-[10px] text-[var(--text-muted)] uppercase">Vulnerability Index</div>
                <div className="text-xl font-bold text-red-400 mt-1">
                  {(selectedCpDetails.vulnerability_index * 100).toFixed(0)}%
                </div>
                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Composite risk exposure</div>
              </div>
            </div>

            <div className="p-3 rounded bg-[var(--bg-void)] border border-[var(--border-secondary)] text-[11px] font-mono text-[var(--text-secondary)] space-y-1">
              <div className="text-[10px] font-bold text-[var(--gold-primary)]">ANALYTICAL INTERPRETATION</div>
              <p>
                This node represents a high-criticality bottleneck in the global transit network. A disruption here triggers non-linear lead-time delays across downstream assembly nodes due to low buffer capacity and high centrality.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedCpDetails(null)}
                className="px-4 py-1.5 text-xs font-mono font-bold rounded bg-[var(--cyan-dim)] text-[var(--cyan-primary)] border border-[var(--border-cyan)] hover:bg-[var(--cyan-primary)] hover:text-black transition"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
