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
  Plus,
  X,
} from 'lucide-react';
import {
  runDecisionStressTest,
  getMitigationsComparison,
} from '@/lib/api';
import type { MitigationComparisonItem, DecisionStressTestResult } from '@/lib/contracts';
import { MOCK_DECISION_STRESS_TEST, MOCK_MITIGATIONS } from '@/lib/mock';
import KillChainModal, { KillChainButton, type KillChainAction } from '@/components/KillChainModal';

interface ScenarioPreset {
  id: string;
  name: string;
  tag: string;
  targetType: string;
  targetId: string;
  customTargetName?: string;
  scenario: string;
  duration: number;
  severity: number;
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'hormuz-blackout',
    name: 'Hormuz AIS Blackout & Tanker Halt',
    tag: 'GEO-POLITICAL',
    targetType: 'chokepoint',
    targetId: 'cp.strait_of_hormuz',
    scenario: 'Electronic warfare disabling maritime transponders; IRGC boardings halting 65% tanker and container movements through the Strait of Hormuz.',
    duration: 30,
    severity: 85,
  },
  {
    id: 'redsea-bypass',
    name: 'Red Sea 45d Bypass (Cape Route)',
    tag: 'MARITIME CHOKE',
    targetType: 'route',
    targetId: 'cp.bab_el_mandeb',
    scenario: 'Sustained anti-ship ballistic strikes forcing 100% Asia-Europe container traffic around the Cape of Good Hope, adding +14 to +18 days transit lead-time.',
    duration: 45,
    severity: 100,
  },
  {
    id: 'taiwan-blockade',
    name: 'Taiwan Strait Semiconductor Embargo',
    tag: 'CRITICAL TECH',
    targetType: 'supplier',
    targetId: 'supplier-tsmc',
    scenario: 'Joint naval exclusion zone surrounding Hsinchu & Kaohsiung ports, freezing export air/sea freight for 12nm automotive MCU wafers.',
    duration: 21,
    severity: 95,
  },
  {
    id: 'novorossiysk-drone',
    name: 'Novorossiysk Export Terminal Strike',
    tag: 'CUSTOM PORT',
    targetType: 'port',
    targetId: 'custom',
    customTargetName: 'Novorossiysk Export Terminal',
    scenario: 'Explosive naval drone strike knocking out export gantries at berths 3 and 4, stranding titanium and specialty alloy raw material exports.',
    duration: 28,
    severity: 90,
  },
  {
    id: 'singapore-megaport',
    name: 'Singapore Megaport Berth Congestion',
    tag: 'TRANSSHIPMENT',
    targetType: 'port',
    targetId: 'port-singapore',
    scenario: 'Cascading container yard saturation reaching 98% density; transshipment container dwell time increases from 3.2 days to 16.8 days.',
    duration: 30,
    severity: 80,
  },
];

export default function ScenariosPage() {
  const [mitigations, setMitigations] = useState<MitigationComparisonItem[]>(MOCK_MITIGATIONS);
  const [stressResult, setStressResult] = useState<DecisionStressTestResult>(MOCK_DECISION_STRESS_TEST);
  
  // Stress test inputs
  const [targetType, setTargetType] = useState('port');
  const [targetId, setTargetId] = useState('port-singapore');
  const [customTargetName, setCustomTargetName] = useState('');
  const [customScenario, setCustomScenario] = useState('');
  const [durationDays, setDurationDays] = useState(30);
  const [severityPct, setSeverityPct] = useState(100);
  const [simulating, setSimulating] = useState(false);

  // Planning workspace state
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set(['mit-expedite-01']));

  // Custom intervention injection state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [cActionType, setCActionType] = useState('AIR_EXPEDITE');
  const [cDesc, setCDesc] = useState('');
  const [cCost, setCCost] = useState('1500000');
  const [cLeadDays, setCLeadDays] = useState('14');
  const [cStockoutProb, setCStockoutProb] = useState('12');
  const [cOrders, setCOrders] = useState('195');
  const [cRevenue, setCRevenue] = useState('28000000');
  const [cBestBefore, setCBestBefore] = useState('24 Sep 2026');
  const [killChainAction, setKillChainAction] = useState<KillChainAction | null>(null);

  useEffect(() => {
    getMitigationsComparison().then((res) => {
      if (res && res.length) setMitigations(res);
      else setMitigations(MOCK_MITIGATIONS);
    }).catch(() => setMitigations(MOCK_MITIGATIONS));
  }, []);

  const handleRunSimulation = async () => {
    setSimulating(true);
    try {
      const resolvedTargetName =
        targetId === 'custom'
          ? (customTargetName.trim() || 'Custom Facility')
          : undefined;

      const res = await runDecisionStressTest({
        target_type: targetType,
        target_id: targetId,
        target_name: resolvedTargetName,
        custom_scenario: customScenario.trim() || undefined,
        duration_days: durationDays,
        severity_pct: severityPct,
      });

      setStressResult(res);

      if (res.custom_mitigations && res.custom_mitigations.length > 0) {
        setMitigations(res.custom_mitigations);
        const best = res.custom_mitigations.find((m) => m.is_best_value) || res.custom_mitigations[0];
        setSelectedPlanIds(new Set([best.id]));
      } else {
        setMitigations(MOCK_MITIGATIONS);
        setSelectedPlanIds(new Set([MOCK_MITIGATIONS[0].id]));
      }
    } catch {
      setStressResult(MOCK_DECISION_STRESS_TEST);
      setMitigations(MOCK_MITIGATIONS);
    } finally {
      setSimulating(false);
    }
  };

  const handleAddCustomIntervention = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cTitle.trim()) return;

    const newMit: MitigationComparisonItem = {
      id: `mit-custom-${Date.now()}`,
      action_type: cActionType,
      title: cTitle.trim(),
      description: cDesc.trim() || 'Planner-injected contingency intervention.',
      cost_inr: Number(cCost) || 1200000,
      lead_time_improvement_days: Number(cLeadDays) || 10,
      stockout_probability_after: (Number(cStockoutProb) || 15) / 100,
      orders_protected_count: Number(cOrders) || 150,
      revenue_protected_inr: Number(cRevenue) || 20000000,
      is_best_value: false,
      decision_window_days: 7,
      best_before_date: cBestBefore.trim() || '25 Sep 2026',
    };

    setMitigations((prev) => [newMit, ...prev]);
    setSelectedPlanIds((prev) => new Set([...prev, newMit.id]));
    setShowCustomModal(false);
    setCTitle('');
    setCDesc('');
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

  const activeTargetDisplayName =
    targetId === 'custom'
      ? (customTargetName || 'Custom Target Entity')
      : stressResult.target_name || targetId;

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#112818] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#00e676]/20 border border-[#00e676]/40 px-2 py-0.5 text-[10px] text-[#00e676]">
              [LLM SCENARIO ENGINE & SANDBOX]
            </span>
            <span className="text-xs text-[#4e6e58]">MONTE CARLO STRESS TESTING & ACTION OPTIMIZATION</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wide text-white mt-1">
            SCENARIO SANDBOX & PLANNING WORKSPACE
          </h1>
          <p className="text-xs text-[#87a894] mt-0.5 font-sans">
            Simulate 10,000 synthetic futures across arbitrary global chokepoints, synthesize LLM-grounded interventions, and compose executable decision baskets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-[#000000] border border-[#112818] px-3 py-1 text-xs text-[#87a894] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00e676]" />
            <span>LLM INTERVENTION SYNTHESIS ACTIVE</span>
          </span>
        </div>
      </div>

      {/* Row 1: Interactive Failure Configurator & Survival Clock Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Failure Configurator (5 cols) */}
        <div className="lg:col-span-5 border border-[#112818] bg-[#000000] p-5 space-y-4">
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
              <div className="grid grid-cols-4 gap-1.5">
                {['port', 'chokepoint', 'supplier', 'route'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTargetType(type)}
                    className={`border py-1.5 uppercase font-bold transition text-[11px] ${
                      targetType === type
                        ? 'border-[#00e676] bg-[#00e676]/20 text-[#00e676]'
                        : 'border-[#112818] bg-[#050805] text-[#87a894] hover:text-white'
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
                className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
              >
                <option value="port-singapore">Port of Singapore (Transshipment Hub)</option>
                <option value="cp.strait_of_hormuz">Strait of Hormuz (Energy & Feeder Corridor)</option>
                <option value="cp.bab_el_mandeb">Bab-el-Mandeb / Red Sea (Trunk Route)</option>
                <option value="cp.taiwan_strait">Taiwan Strait (Semiconductor Corridor)</option>
                <option value="supplier-tsmc">TSMC Sub-Fab 14 (Hsinchu - Microcontrollers)</option>
                <option value="sup-alpha">Supplier Alpha Components GmbH (Munich - Power ICs)</option>
                <option value="port-jnpt">Jawaharlal Nehru Port (JNPT Mumbai Gateway)</option>
                <option value="custom">[+ Enter Custom Target Entity...]</option>
              </select>
            </div>

            {targetId === 'custom' && (
              <div>
                <label className="text-[10px] text-[#00e676] uppercase block mb-1 flex items-center gap-1">
                  <span>Custom Target Facility / Chokepoint:</span>
                  <span className="text-[#4e6e58]">(Any Global Port / Supplier / Node)</span>
                </label>
                <input
                  type="text"
                  value={customTargetName}
                  onChange={(e) => setCustomTargetName(e.target.value)}
                  placeholder="e.g. Novorossiysk Terminal, Suwalki Gap, JNPT, or Bosch Fab..."
                  className="w-full border border-[#00e676]/60 bg-[#050805] px-3 py-2 text-xs text-white placeholder:text-[#4e6e58] focus:border-[#00e676] focus:outline-none"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-[#4e6e58] uppercase block">
                  Scenario Shock Hypothesis (Custom / Presets):
                </label>
                <span className="text-[9px] text-[#00e676]">LLM SYNTHESIS</span>
              </div>
              <textarea
                rows={2}
                value={customScenario}
                onChange={(e) => setCustomScenario(e.target.value)}
                placeholder="Describe disruption or pick a preset below (e.g., naval drone strike, AIS blackout, embargo)..."
                className="w-full border border-[#112818] bg-[#050805] p-2 text-xs text-white placeholder:text-[#4e6e58] focus:border-[#00e676] focus:outline-none resize-none"
              />

              {/* Quick Presets */}
              <div className="mt-2 space-y-1">
                <div className="text-[9px] text-[#4e6e58] uppercase">Instant Presets:</div>
                <div className="flex flex-wrap gap-1">
                  {SCENARIO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setTargetType(preset.targetType);
                        setTargetId(preset.targetId);
                        if (preset.customTargetName) setCustomTargetName(preset.customTargetName);
                        setCustomScenario(preset.scenario);
                        setDurationDays(preset.duration);
                        setSeverityPct(preset.severity);
                      }}
                      className="border border-[#112818] bg-[#050805] px-2 py-1 text-[10px] text-[#87a894] hover:text-[#00e676] hover:border-[#00e676]/40 transition text-left"
                    >
                      <span className="text-[#00e676] mr-1">[{preset.tag}]</span>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
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
                className="flex w-full items-center justify-center gap-2 border border-[#00e676]/60 bg-[#00e676]/20 py-3 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition shadow-[0_0_20px_rgba(0,255,136,0.2)]"
              >
                {simulating ? (
                  <>
                    <span className="animate-spin text-sm">⟳</span>
                    <span>SYNTHESIZING WITH LLM (10,000 RUNS)…</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-[#00e676]" />
                    <span>RUN 10,000 SIMULATION & LLM SYNTHESIS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Operational Survival Clock & Quantiles (7 cols) */}
        <div className="lg:col-span-7 border border-red-500/40 bg-[#000000] p-5 space-y-4 relative overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.1)]">
          {/* Survival Clock Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#112818] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                  [OPERATIONAL SURVIVAL CLOCK]
                </span>
                <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.2 border border-red-500/40">
                  {activeTargetDisplayName.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-[#87a894] mt-0.5">TIME TO FIRST PRODUCTION STOCKOUT:</div>
            </div>
            {/* Visual Survival Clock Number */}
            <div className="flex items-center gap-2 bg-[#050805] px-4 py-2 border border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.25)]">
              <Clock className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-xl sm:text-2xl font-black tracking-widest">
                {stressResult.survival_clock_display}
              </span>
            </div>
          </div>

          {/* Survival Comparison Breakdown */}
          <div className="space-y-2 bg-[#050805] p-4 border border-[#112818] text-xs">
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

          {/* Quantile Distributions */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-[#050805] p-2.5 border border-[#112818]">
              <span className="text-[9px] text-[#4e6e58] uppercase">P50 (Median)</span>
              <div className="font-bold text-white mt-1">{stressResult.operational_survival_p50_days} Days</div>
            </div>
            <div className="bg-[#050805] p-2.5 border border-[#112818]">
              <span className="text-[9px] text-[#4e6e58] uppercase">P75</span>
              <div className="font-bold text-amber-400 mt-1">{stressResult.operational_survival_p75_days} Days</div>
            </div>
            <div className="bg-[#050805] p-2.5 border border-[#112818]">
              <span className="text-[9px] text-[#4e6e58] uppercase">P90</span>
              <div className="font-bold text-red-400 mt-1">{stressResult.operational_survival_p90_days} Days</div>
            </div>
            <div className="bg-[#050805] p-2.5 border border-[#112818]">
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

      {/* Row 2: Mitigation Comparison Table */}
      <div className="border border-[#112818] bg-[#000000] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#112818] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#00e676] font-bold uppercase">[QUANTIFIED MITIGATION ENGINE]</span>
              <span className="text-[9px] bg-[#00e676]/20 text-[#00e676] px-1.5 py-0.2 border border-[#00e676]/40">
                AI SYNTHESIZED
              </span>
            </div>
            <h2 className="text-sm font-bold uppercase text-white mt-0.5">
              COMPARE INTERVENTIONS ACROSS OUTCOMES & COSTS
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCustomModal(true)}
              className="border border-[#00e676]/60 bg-[#00e676]/20 px-3 py-1.5 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>PROPOSE CUSTOM INTERVENTION</span>
            </button>
          </div>
        </div>

        {/* AI Rationale Notice */}
        {stressResult.ai_rationale && (
          <div className="border border-[#00e676]/40 bg-[#00e676]/10 p-3 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#00e676] shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-[#00e676] uppercase flex items-center gap-2">
                <span>LLM OPERATIONAL RATIONALE FOR {activeTargetDisplayName.toUpperCase()}</span>
              </div>
              <p className="text-[#87a894] font-sans mt-0.5">{stressResult.ai_rationale}</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#112818] bg-[#050805] text-[#4e6e58] text-[10px] uppercase tracking-wider">
                <th className="p-3 text-center">Include in Plan</th>
                <th className="p-3">Intervention Action</th>
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 text-right">Lead-Time Delta</th>
                <th className="p-3 text-right">Stockout P</th>
                <th className="p-3 text-right">Orders Protected</th>
                <th className="p-3 text-right">Revenue Protected</th>
                <th className="p-3 text-center">Best Before</th>
                <th className="p-3 text-center">Protocol</th>
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
                          <span className="bg-[#00e676]/20 border border-[#00e676]/40 px-2 py-0.5 text-[9px] font-bold text-[#00e676]">
                            BEST VALUE
                          </span>
                        )}
                        <span className="text-[9px] text-[#4e6e58] uppercase">[{m.action_type}]</span>
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
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <KillChainButton
                        label="EXECUTE"
                        action={{
                          title: `EXECUTE INTERVENTION: ${m.title}`,
                          targetEntity: `Intervention [${m.id}] · ${m.action_type}`,
                          physicalEffect: `Authorizes immediate operational directive for '${m.title}'. ${m.description} - Releases ${formatRupee(m.cost_inr)} from logistics budget to compress inbound transit lead time by ${m.lead_time_improvement_days} days.`,
                          telemetryHook: "EDI 315 / AS2 Webhook / SAP S/4HANA Workflow",
                          budgetCommitment: `${formatRupee(m.cost_inr)} Authorized`,
                          leadTimeDelta: `-${m.lead_time_improvement_days} Days`,
                          riskMitigation: `Secures ${m.orders_protected_count} customer orders and protects ${formatRupee(m.revenue_protected_inr)} revenue exposure.`
                        }}
                        onTrigger={setKillChainAction}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Planning Workspace & Cost of Inaction */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Planning Workspace Basket */}
        <div className="border border-[#00e676]/40 bg-[#000000] p-5 space-y-4">
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
                className="flex items-center justify-between bg-[#050805] p-2.5 border border-[#112818]"
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
          <div className="grid grid-cols-3 gap-2 text-center text-xs bg-[#050805] p-3 border border-[#112818]">
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

          <div className="border-t border-[#112818] pt-3 flex flex-wrap justify-between items-center gap-2">
            <span className="text-[11px] text-[#87a894]">Ready to apply to ERP schedule</span>
            <div className="flex items-center gap-2">
              <KillChainButton
                label="COMMIT TO KILL-CHAIN"
                action={{
                  title: "INTEGRATED MULTI-CHOKE MITIGATION DISPATCH",
                  targetEntity: `Active Mitigation Plan (${selectedPlanIds.size} Interventions Selected)`,
                  physicalEffect: `Authorizes release of ${formatRupee(planAggregates.totalCost)} from logistics contingency reserve. Transmits multi-party carrier EDI directives and triggers ERP purchase order priority upgrades across all impacted facilities.`,
                  telemetryHook: "EDI 315 / AS2 / SAP S/4HANA PO Workflow",
                  budgetCommitment: `${formatRupee(planAggregates.totalCost)} Authorized`,
                  leadTimeDelta: `Residual Stockout P: ${Math.round(planAggregates.residualStockout * 100)}%`,
                  riskMitigation: `Protects ${planAggregates.ordersProtected} orders and ${formatRupee(planAggregates.revenueProtected)} revenue.`
                }}
                onTrigger={setKillChainAction}
              />
              <button className="border border-[#00e676]/60 bg-[#00e676]/20 px-3 py-1.5 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition shadow-[0_0_12px_rgba(0,255,136,0.15)]">
                COMMIT PLAN
              </button>
            </div>
          </div>
        </div>

        {/* Cost of Inaction */}
        <div className="border border-red-500/40 bg-[#000000] p-5 space-y-4">
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
            <div className="bg-[#050805] p-3 border border-[#112818]">
              <span className="text-[10px] text-[#00e676] uppercase font-bold">ACT TODAY</span>
              <div className="text-base font-bold text-white mt-1">₹11.8 L</div>
              <p className="text-[10px] text-[#87a894] mt-1 font-sans">Expedite SHP-8821 air charter</p>
              <div className="mt-2 text-[#00e676] text-[11px] font-bold">Stockout P: 8%</div>
            </div>

            <div className="bg-red-500/10 p-3 border border-red-500/40">
              <span className="text-[10px] text-red-400 uppercase font-bold">WAIT 7 DAYS</span>
              <div className="text-base font-bold text-red-400 mt-1">+₹31.4 L</div>
              <p className="text-[10px] text-red-400/80 mt-1 font-sans">Compounded emergency premiums</p>
              <div className="mt-2 text-red-400 text-[11px] font-bold">3 Additional Stockouts</div>
            </div>
          </div>

          <div className="bg-[#050805] p-3 border border-[#112818] text-[11px] text-[#87a894] space-y-1">
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

      {/* Custom Intervention Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-xl border border-[#00e676] bg-[#000000] p-6 space-y-4 shadow-[0_0_50px_rgba(0,255,136,0.2)]">
            <div className="flex items-center justify-between border-b border-[#112818] pb-3">
              <div>
                <span className="text-[10px] text-[#00e676] font-bold uppercase">[MANUAL INTERVENTION INJECTION]</span>
                <h3 className="text-sm font-bold uppercase text-white mt-0.5">PROPOSE CUSTOM MITIGATION ACTION</h3>
              </div>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-[#87a894] hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomIntervention} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">Action Title:</label>
                  <input
                    type="text"
                    required
                    value={cTitle}
                    onChange={(e) => setCTitle(e.target.value)}
                    placeholder="e.g. Air Charter via Muscat Hub"
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white placeholder:text-[#4e6e58] focus:border-[#00e676] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">Action Type:</label>
                  <select
                    value={cActionType}
                    onChange={(e) => setCActionType(e.target.value)}
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                  >
                    <option value="AIR_EXPEDITE">AIR EXPEDITE</option>
                    <option value="ALTERNATIVE_SUPPLIER">ALTERNATIVE SUPPLIER</option>
                    <option value="BUFFER_REALLOCATION">BUFFER REALLOCATION</option>
                    <option value="DEMAND_RATIONING">DEMAND RATIONING</option>
                    <option value="INTERMODAL_REROUTE">INTERMODAL REROUTE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">Description:</label>
                <textarea
                  rows={2}
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                  placeholder="e.g. Charter 2x Boeing 777F carrying 140T critical semiconductor trays directly into Mumbai BOM..."
                  className="w-full border border-[#112818] bg-[#050805] p-2 text-xs text-white placeholder:text-[#4e6e58] focus:border-[#00e676] focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">Cost (INR):</label>
                  <input
                    type="number"
                    value={cCost}
                    onChange={(e) => setCCost(e.target.value)}
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">Lead Time Gain (Days):</label>
                  <input
                    type="number"
                    value={cLeadDays}
                    onChange={(e) => setCLeadDays(e.target.value)}
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">Residual Stockout (%):</label>
                  <input
                    type="number"
                    value={cStockoutProb}
                    onChange={(e) => setCStockoutProb(e.target.value)}
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">Orders Protected:</label>
                  <input
                    type="number"
                    value={cOrders}
                    onChange={(e) => setCOrders(e.target.value)}
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">Revenue Protected (INR):</label>
                  <input
                    type="number"
                    value={cRevenue}
                    onChange={(e) => setCRevenue(e.target.value)}
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#4e6e58] uppercase block mb-1">Decision Deadline:</label>
                  <input
                    type="text"
                    value={cBestBefore}
                    onChange={(e) => setCBestBefore(e.target.value)}
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#112818] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="border border-[#112818] bg-[#050805] px-4 py-2 text-xs font-bold text-[#87a894] hover:text-white transition"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="border border-[#00e676] bg-[#00e676]/20 px-4 py-2 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition shadow-[0_0_15px_rgba(0,255,136,0.2)]"
                >
                  INJECT INTERVENTION INTO PLAN MATRIX
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gotham Kill-Chain Protocol Modal */}
      <KillChainModal
        isOpen={Boolean(killChainAction)}
        onClose={() => setKillChainAction(null)}
        action={killChainAction}
      />
    </div>
  );
}
