'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Play,
  Check,
  RotateCcw,
  Zap,
  Info,
} from 'lucide-react';
import { runDecisionStressTest, getMitigationsComparison } from '@/lib/api';
import type { MitigationComparisonItem, DecisionStressTestResult } from '@/lib/contracts';
import { MOCK_MITIGATIONS, MOCK_DECISION_STRESS_TEST } from '@/lib/mock';

export default function ScenariosPage() {
  const [mitigations, setMitigations] = useState<MitigationComparisonItem[]>(MOCK_MITIGATIONS);
  const [stressResult, setStressResult] = useState<DecisionStressTestResult>(MOCK_DECISION_STRESS_TEST);
  
  // Stress test inputs
  const [targetType, setTargetType] = useState('port');
  const [targetId, setTargetId] = useState('port-singapore');
  const [durationDays, setDurationDays] = useState(30);
  const [severityPct, setSeverityPct] = useState(100);
  const [simulating, setSimulating] = useState(false);

  // Planning workspace state
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set(['mit-expedite-01']));

  useEffect(() => {
    getMitigationsComparison().then((res) => {
      if (res && res.length) setMitigations(res);
    }).catch(() => {});
  }, []);

  const handleRunSimulation = async () => {
    setSimulating(true);
    try {
      const res = await runDecisionStressTest({
        target_type: targetType,
        target_id: targetId,
        duration_days: durationDays,
        severity_pct: severityPct,
      });
      setStressResult(res);
    } catch {
      setStressResult(MOCK_DECISION_STRESS_TEST);
    } finally {
      setSimulating(false);
    }
  };

  const togglePlanAction = (id: string) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatRupee = (amt: number) => {
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)} L`;
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  // Plan aggregates
  const planAggregates = (() => {
    let totalCost = 0;
    let ordersProtected = 0;
    let revenueProtected = 0;
    let residualStockout = 0.78;

    mitigations.forEach((m) => {
      if (selectedPlanIds.has(m.id)) {
        totalCost += m.cost_inr;
        ordersProtected = Math.max(ordersProtected, m.orders_protected_count);
        revenueProtected = Math.max(revenueProtected, m.revenue_protected_inr);
        residualStockout = Math.min(residualStockout, m.stockout_probability_after);
      }
    });

    return {
      totalCost,
      ordersProtected,
      revenueProtected,
      residualStockout: selectedPlanIds.size === 0 ? 0.78 : residualStockout,
    };
  })();

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#112818] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#00e676]/20 border border-[#00e676]/40 px-2 py-0.5 text-[10px] text-[#00e676]">
              [SIMULATION & INTERVENTION]
            </span>
            <span className="text-xs text-[#4e6e58]">MONTE CARLO STRESS TESTING & ACTION OPTIMIZATION</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wide text-white mt-1">
            SCENARIO SANDBOX & PLANNING WORKSPACE
          </h1>
          <p className="text-xs text-[#87a894] mt-0.5 font-sans">
            Simulate 10,000 synthetic futures across catastrophic bottleneck failures, evaluate operational survival runways, and optimize interventions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded bg-[#020503] border border-[#112818] px-3 py-1 text-xs text-[#87a894]">
            ENGINE: MONTE CARLO N=10,000
          </span>
        </div>
      </div>

      {/* Row 1: Survival Clock Hero & Stress Test Sandbox (Section 37, 38, 40) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Failure Configurator (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-[#112818] bg-[#020503] p-5 space-y-4">
          <div className="border-b border-[#112818] pb-2 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-[#00e676] font-bold uppercase">[STEP 1 & 2]</span>
              <h2 className="text-xs font-bold uppercase text-white mt-0.5">FAILURE SANDBOX SETUP</h2>
            </div>
            <span className="text-[10px] text-[#4e6e58]">CUSTOM CHOKEPOINT SHOCK</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">Failure Domain:</label>
              <div className="grid grid-cols-3 gap-2">
                {['port', 'supplier', 'route'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTargetType(type)}
                    className={`rounded border py-1.5 uppercase font-bold transition text-xs ${
                      targetType === type
                        ? 'border-[#00e676] bg-[#00e676]/20 text-[#00e676]'
                        : 'border-[#112818] bg-[#000000] text-[#87a894] hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">Target Entity:</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded border border-[#112818] bg-[#000000] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
              >
                <option value="port-singapore">Port of Singapore (Transshipment Hub)</option>
                <option value="cp.strait_of_hormuz">Strait of Hormuz (Energy Corridor)</option>
                <option value="sup-alpha">Supplier Alpha Components GmbH</option>
                <option value="suez-canal">Suez Canal / Red Sea Trunk</option>
                <option value="supplier-tsmc">TSMC Sub-Fab 14 (Hsinchu)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">
                  Duration ({durationDays} Days):
                </label>
                <input
                  type="range"
                  min={7}
                  max={60}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full accent-[#00e676]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">
                  Severity ({severityPct}%):
                </label>
                <input
                  type="range"
                  min={25}
                  max={100}
                  value={severityPct}
                  onChange={(e) => setSeverityPct(Number(e.target.value))}
                  className="w-full accent-[#00e676]"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleRunSimulation}
                disabled={simulating}
                className="flex w-full items-center justify-center gap-2 rounded border border-[#00e676]/60 bg-[#00e676]/20 py-3 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition shadow-[0_0_20px_rgba(0,255,136,0.2)]"
              >
                {simulating ? (
                  <>
                    <span className="animate-spin text-sm">⟳</span>
                    <span>RUNNING 10,000 MONTE CARLO FUTURES…</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-[#00e676]" />
                    <span>RUN 10,000 FUTURES SIMULATION</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Operational Survival Clock & Quantiles (Section 38 & 40) (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-red-500/40 bg-[#020503] p-5 space-y-4 relative overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.1)]">
          {/* Survival Clock Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#112818] pb-3">
            <div>
              <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                [OPERATIONAL SURVIVAL CLOCK]
              </span>
              <div className="text-xs text-[#87a894] mt-0.5">TIME TO FIRST PRODUCTION STOCKOUT:</div>
            </div>
            {/* Visual Survival Clock Number */}
            <div className="flex items-center gap-2 bg-[#000000] px-4 py-2 rounded-lg border border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.25)]">
              <Clock className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-xl sm:text-2xl font-black tracking-widest">
                {stressResult.survival_clock_display}
              </span>
            </div>
          </div>

          {/* Survival Comparison Breakdown (Section 40) */}
          <div className="space-y-2 bg-[#000000] p-4 rounded-lg border border-[#112818] text-xs">
            <div className="flex justify-between items-center text-[#87a894]">
              <span>WITHOUT MITIGATION (BASELINE):</span>
              <strong className="text-red-400">{stressResult.survival_unmitigated_days} DAYS</strong>
            </div>
            <div className="flex justify-between items-center text-[#87a894]">
              <span>WITH INVENTORY REALLOCATION:</span>
              <strong className="text-amber-400">{stressResult.survival_reallocated_days} DAYS (+8d)</strong>
            </div>
            <div className="flex justify-between items-center text-[#87a894]">
              <span>WITH AIR EXPEDITING:</span>
              <strong className="text-[#00e676]">{stressResult.survival_expedited_days} DAYS (+16d)</strong>
            </div>
          </div>

          {/* Quantile Distributions (Section 38) */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-[#000000] p-2.5 rounded border border-[#112818]">
              <span className="text-[9px] text-[#4e6e58] uppercase">P50 (Median)</span>
              <div className="font-bold text-white mt-1">{stressResult.operational_survival_p50_days} Days</div>
            </div>
            <div className="bg-[#000000] p-2.5 rounded border border-[#112818]">
              <span className="text-[9px] text-[#4e6e58] uppercase">P75</span>
              <div className="font-bold text-amber-400 mt-1">{stressResult.operational_survival_p75_days} Days</div>
            </div>
            <div className="bg-[#000000] p-2.5 rounded border border-[#112818]">
              <span className="text-[9px] text-[#4e6e58] uppercase">P90</span>
              <div className="font-bold text-red-400 mt-1">{stressResult.operational_survival_p90_days} Days</div>
            </div>
            <div className="bg-[#000000] p-2.5 rounded border border-[#112818]">
              <span className="text-[9px] text-[#4e6e58] uppercase">P99</span>
              <div className="font-bold text-red-400 mt-1">{stressResult.operational_survival_p99_days} Days</div>
            </div>
          </div>

          {/* Consequence Metrics */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-[#112818] pt-3">
            <div>
              <span className="text-[9px] text-[#4e6e58] uppercase">Stockouts</span>
              <div className="font-bold text-red-400 mt-0.5">{stressResult.stockout_skus_count} SKUs</div>
            </div>
            <div>
              <span className="text-[9px] text-[#4e6e58] uppercase">Orders Exposed</span>
              <div className="font-bold text-amber-400 mt-0.5">{stressResult.orders_exposed_count} Orders</div>
            </div>
            <div>
              <span className="text-[9px] text-[#4e6e58] uppercase">Revenue Exposed</span>
              <div className="font-bold text-[#00e676] mt-0.5">{formatRupee(stressResult.revenue_exposed_inr)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Mitigation Comparison Table (Section 35) */}
      <div className="rounded-xl border border-[#112818] bg-[#020503] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#112818] pb-2">
          <div>
            <span className="text-[10px] text-[#00e676] font-bold uppercase">[QUANTIFIED MITIGATION ENGINE]</span>
            <h2 className="text-sm font-bold uppercase text-white mt-0.5">
              COMPARE INTERVENTIONS ACROSS OUTCOMES & COSTS
            </h2>
          </div>
          <span className="text-[10px] text-[#4e6e58]">SELECT ACTIONS TO COMPOSE YOUR PLAN</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#112818] bg-[#000000] text-[#4e6e58] text-[10px] uppercase tracking-wider">
                <th className="p-3 text-center">Include in Plan</th>
                <th className="p-3">Intervention Action</th>
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 text-right">Lead-Time Delta</th>
                <th className="p-3 text-right">Stockout P</th>
                <th className="p-3 text-right">Orders Protected</th>
                <th className="p-3 text-right">Revenue Protected</th>
                <th className="p-3 text-center">Best Before</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0e2716]">
              {mitigations.map((m) => {
                const isSelected = selectedPlanIds.has(m.id);
                return (
                  <tr
                    key={m.id}
                    onClick={() => togglePlanAction(m.id)}
                    className={`cursor-pointer transition ${
                      isSelected ? 'bg-[#00e676]/10' : 'hover:bg-[#00e676]/5'
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePlanAction(m.id)}
                        className="accent-[#00e676] w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <strong className="text-white">{m.title}</strong>
                        {m.is_best_value && (
                          <span className="rounded bg-[#00e676]/20 border border-[#00e676]/40 px-2 py-0.5 text-[9px] font-bold text-[#00e676]">
                            BEST VALUE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#87a894] truncate max-w-sm mt-0.5">
                        {m.description}
                      </p>
                    </td>
                    <td className="p-3 text-right font-bold text-white">{formatRupee(m.cost_inr)}</td>
                    <td className="p-3 text-right text-[#00e676] font-bold">
                      -{m.lead_time_improvement_days}d
                    </td>
                    <td className="p-3 text-right font-bold text-[#00e676]">
                      {Math.round(m.stockout_probability_after * 100)}%
                    </td>
                    <td className="p-3 text-right text-white font-bold">{m.orders_protected_count}</td>
                    <td className="p-3 text-right text-[#00e676] font-bold">
                      {formatRupee(m.revenue_protected_inr)}
                    </td>
                    <td className="p-3 text-center text-[#87a894] text-[10px]">{m.best_before_date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Planning Workspace & Cost of Inaction (Section 75, 76, 77, 100) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Planning Workspace Basket */}
        <div className="rounded-xl border border-[#00e676]/40 bg-[#020503] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#112818] pb-2">
            <div>
              <span className="text-[10px] text-[#00e676] font-bold uppercase">[DECISION WORKSPACE]</span>
              <h3 className="text-sm font-bold uppercase text-white mt-0.5">COMPOSED MITIGATION PLAN</h3>
            </div>
            <span className="text-xs text-[#00e676] font-bold">{selectedPlanIds.size} Actions Active</span>
          </div>

          <div className="space-y-2 text-xs">
            {mitigations.filter((m) => selectedPlanIds.has(m.id)).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-[#000000] p-2.5 rounded border border-[#112818]"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00e676]" />
                  <span className="text-white font-bold">{m.title}</span>
                </div>
                <span className="text-[#00e676] font-bold">{formatRupee(m.cost_inr)}</span>
              </div>
            ))}
          </div>

          {/* Aggregated Outcome */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs bg-[#000000] p-3 rounded border border-[#112818]">
            <div>
              <span className="text-[9px] text-[#4e6e58] uppercase">Total Cost</span>
              <div className="font-bold text-white mt-0.5">{formatRupee(planAggregates.totalCost)}</div>
            </div>
            <div>
              <span className="text-[9px] text-[#4e6e58] uppercase">Orders Protected</span>
              <div className="font-bold text-[#00e676] mt-0.5">{planAggregates.ordersProtected}</div>
            </div>
            <div>
              <span className="text-[9px] text-[#4e6e58] uppercase">Residual Stockout P</span>
              <div className="font-bold text-[#00e676] mt-0.5">
                {Math.round(planAggregates.residualStockout * 100)}%
              </div>
            </div>
          </div>

          <div className="border-t border-[#112818] pt-3 flex justify-between items-center">
            <span className="text-[11px] text-[#87a894]">Ready to apply to ERP schedule</span>
            <button className="rounded border border-[#00e676]/60 bg-[#00e676]/20 px-4 py-2 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition shadow-[0_0_12px_rgba(0,255,136,0.15)]">
              COMMIT DECISION PLAN
            </button>
          </div>
        </div>

        {/* Cost of Inaction (Section 100 & 77) */}
        <div className="rounded-xl border border-red-500/40 bg-[#020503] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#112818] pb-2">
            <div>
              <span className="text-[10px] text-red-400 font-bold uppercase">[DECISION URGENCY]</span>
              <h3 className="text-sm font-bold uppercase text-white mt-0.5">COST OF INACTION (7-DAY DELAY)</h3>
            </div>
            <span className="text-[10px] text-red-400 font-bold">DECISION WINDOW: 9 DAYS REMAINING</span>
          </div>

          <p className="text-xs text-[#87a894] font-sans">
            Quantified operational penalty if action is deferred past the effective intervention deadline:
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#000000] p-3 rounded border border-[#112818]">
              <span className="text-[10px] text-[#00e676] uppercase font-bold">ACT TODAY</span>
              <div className="text-base font-bold text-white mt-1">₹11.8 L</div>
              <p className="text-[10px] text-[#87a894] mt-1 font-sans">Expedite SHP-8821 air charter</p>
              <div className="mt-2 text-[#00e676] text-[11px] font-bold">Stockout P: 8%</div>
            </div>

            <div className="bg-red-500/10 p-3 rounded border border-red-500/40">
              <span className="text-[10px] text-red-400 uppercase font-bold">WAIT 7 DAYS</span>
              <div className="text-base font-bold text-red-400 mt-1">+₹31.4 L</div>
              <p className="text-[10px] text-red-400/80 mt-1 font-sans">Compounded emergency premiums</p>
              <div className="mt-2 text-red-400 text-[11px] font-bold">3 Additional Stockouts</div>
            </div>
          </div>

          <div className="rounded bg-[#000000] p-3 border border-[#112818] text-[11px] text-[#87a894] space-y-1">
            <div className="flex justify-between">
              <span>Additional customer orders breached:</span>
              <span className="text-red-400 font-bold">+47 orders</span>
            </div>
            <div className="flex justify-between">
              <span>Automotive tier-1 plant downtime:</span>
              <span className="text-red-400 font-bold">3 full shifts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
