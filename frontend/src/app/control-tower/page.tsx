'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  ShieldAlert,
  AlertTriangle,
  Clock,
  TrendingUp,
  Box,
  Truck,
  Anchor,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Info,
  Layers,
  CheckCircle2,
  HelpCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import { getDashboardSummary, getAlerts } from '@/lib/api';
import type { DashboardSummary, AlertCard } from '@/lib/contracts';
import { MOCK_DASHBOARD_SUMMARY, MOCK_ALERTS } from '@/lib/mock';
import AIAnalystModal from '@/components/AIAnalystModal';

export default function ControlTowerPage() {
  const [summary, setSummary] = useState<DashboardSummary>(MOCK_DASHBOARD_SUMMARY);
  const [alerts, setAlerts] = useState<AlertCard[]>(MOCK_ALERTS);
  const [selectedWhyDisruption, setSelectedWhyDisruption] = useState<string | null>(null);
  const [showHealthMethodology, setShowHealthMethodology] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    getDashboardSummary().then(setSummary).catch(() => {});
    getAlerts().then((res) => {
      if (res && res.length) setAlerts(res);
    }).catch(() => {});
  }, []);

  const formatRupee = (amt: number) => {
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)} L`;
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full font-mono">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#143a22] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#00ff88]/20 border border-[#00ff88]/40 px-2 py-0.5 text-[10px] text-[#00ff88]">
              [OBSERVED + INFERRED]
            </span>
            <span className="text-xs text-[#4e6e58]">CONTINUOUS NETWORK SURVEILLANCE</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wide text-white mt-1">
            EXECUTIVE & OPERATIONAL CONTROL TOWER
          </h1>
          <p className="text-xs text-[#87a894] mt-0.5 font-sans">
            Real-time causal disruption tracking, multi-tier dependency propagation, and predictive operational impact.
          </p>
        </div>

        <button
          onClick={() => {
            setAiPrompt('Provide executive briefing on current network stress and exposed orders');
            setAiModalOpen(true);
          }}
          className="flex items-center gap-2 rounded border border-[#00ff88]/60 bg-[#00ff88]/15 px-4 py-2 text-xs font-bold text-[#00ff88] hover:bg-[#00ff88]/25 shadow-[0_0_15px_rgba(0,255,136,0.15)] transition"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI EXECUTIVE BRIEFING</span>
        </button>
      </div>

      {/* Row 1: Hero Metrics Grid (Section 16 & 17) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Network Health Card */}
        <div
          onClick={() => setShowHealthMethodology(true)}
          className="rounded-lg border border-[#143a22] bg-[#07140b] p-4 cursor-pointer hover:border-[#00ff88]/60 transition group relative overflow-hidden"
        >
          <div className="flex justify-between items-start text-[#4e6e58]">
            <span className="text-[10px] uppercase font-bold tracking-wider">Network Health</span>
            <Info className="w-3.5 h-3.5 group-hover:text-[#00ff88] transition" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-[#00ff88]">
              {Math.round(summary.network_health)}
            </span>
            <span className="text-xs text-[#4e6e58]">/ 100</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-[#44ffa2]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
            <span>5 Sub-indices tracked</span>
          </div>
        </div>

        {/* Active Disruptions */}
        <div className="rounded-lg border border-[#143a22] bg-[#07140b] p-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#4e6e58]">Active Disruptions</span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-red-400">
            {summary.active_disruptions_count}
          </div>
          <div className="mt-2 text-[10px] text-red-400/80">
            {summary.critical_chokepoints_count} critical bottlenecks
          </div>
        </div>

        {/* Exposed Orders */}
        <div className="rounded-lg border border-[#143a22] bg-[#07140b] p-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#4e6e58]">Exposed Orders</span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-400">
            {summary.exposed_orders_count}
          </div>
          <div className="mt-2 text-[10px] text-[#87a894]">
            Across 14 customer contracts
          </div>
        </div>

        {/* At-Risk SKUs */}
        <div className="rounded-lg border border-[#143a22] bg-[#07140b] p-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#4e6e58]">At-Risk SKUs</span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-[#00ff88]">
            {summary.at_risk_skus_count}
          </div>
          <div className="mt-2 text-[10px] text-amber-400">
            {summary.predicted_stockouts_count} stockouts predicted
          </div>
        </div>

        {/* Latent Stress */}
        <div className="rounded-lg border border-[#143a22] bg-[#07140b] p-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#4e6e58]">Network Stress</span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-400">
            {Math.round(summary.network_stress_pct)}%
          </div>
          <div className="mt-2 text-[10px] text-[#87a894]">
            ▲ +12% vs 7-day prior
          </div>
        </div>

        {/* Revenue Exposure */}
        <div className="rounded-lg border border-[#143a22] bg-[#07140b] p-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#4e6e58]">Revenue Exposure</span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-[#00ff88]">
            {formatRupee(summary.revenue_exposure_inr)}
          </div>
          <div className="mt-2 text-[10px] text-red-400">
            Avg Delay: +{summary.expected_delay_days}d
          </div>
        </div>
      </div>

      {/* Row 2: Planner Priority Queue (Section 94) */}
      <div className="rounded-xl border border-[#143a22] bg-[#07140b]/80 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#143a22] pb-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              TODAY'S OPERATIONAL PRIORITIES (PLANNER QUEUE)
            </h2>
          </div>
          <span className="text-[10px] text-[#4e6e58]">RANKED BY FINANCIAL CONSEQUENCE & TIME URGENCY</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Priority 1 */}
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                01 · STOCKOUT IMMINENT
              </span>
              <span className="text-[11px] font-bold text-red-400">11.0d Runway</span>
            </div>
            <div>
              <div className="text-sm font-bold text-white">SKU-441 (Power Controller)</div>
              <p className="text-[11px] text-[#87a894] font-sans">
                Choked via Singapore Port. 43 orders exposed valued at ₹28.4L.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-[#143a22] pt-2 text-xs">
              <Link
                href="/scenarios"
                className="flex items-center gap-1 text-[#00ff88] hover:underline text-[11px]"
              >
                <span>Expedite Air (+12.4d)</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link href="/exposure?sku=SKU-441" className="text-[#87a894] hover:text-white text-[10px]">
                [VIEW SKU]
              </Link>
            </div>
          </div>

          {/* Priority 2 */}
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                02 · CRITICAL SHIPMENT DELAY
              </span>
              <span className="text-[11px] font-bold text-amber-400">74% P(Late)</span>
            </div>
            <div>
              <div className="text-sm font-bold text-white">Shipment SHP-8821 (Taipei → Sin)</div>
              <p className="text-[11px] text-[#87a894] font-sans">
                Delayed +6.4d at outer anchorage. Chokes automotive gateway production.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-[#143a22] pt-2 text-xs">
              <Link
                href="/scenarios"
                className="flex items-center gap-1 text-[#00ff88] hover:underline text-[11px]"
              >
                <span>Reroute Bypass</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link href="/command" className="text-[#87a894] hover:text-white text-[10px]">
                [LOCATE ON GLOBE]
              </Link>
            </div>
          </div>

          {/* Priority 3 */}
          <div className="rounded-lg border border-[#143a22] bg-[#040806] p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="rounded bg-[#00ff88]/20 px-2 py-0.5 text-[10px] font-bold text-[#00ff88]">
                03 · SINGLE-SOURCE EXPOSURE
              </span>
              <span className="text-[11px] text-amber-400">Risk 67 / 100</span>
            </div>
            <div>
              <div className="text-sm font-bold text-white">Supplier Alpha Components GmbH</div>
              <p className="text-[11px] text-[#87a894] font-sans">
                72% sole-source dependency for MCU chips. Tier-2 risk on TSMC Fab 14.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-[#143a22] pt-2 text-xs">
              <Link
                href="/suppliers"
                className="flex items-center gap-1 text-[#00ff88] hover:underline text-[11px]"
              >
                <span>Simulate Second Source</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link href="/suppliers" className="text-[#87a894] hover:text-white text-[10px]">
                [VIEW TIER-2]
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Emerging Disruptions & Bayesian "Why?" Cards (Section 18 & 53) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#143a22] pb-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              EMERGING DISRUPTIONS & CAUSAL ATTRIBUTION
            </h2>
            <p className="text-xs text-[#87a894] font-sans">
              Probabilistic multi-signal convergence triggering operational lead-time cascades.
            </p>
          </div>
          <Link
            href="/command"
            className="text-xs font-bold text-[#00ff88] hover:underline flex items-center gap-1"
          >
            <span>EXPLORE FULL GLOBE</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Port of Singapore (Canonical Demo) */}
          <div className="rounded-xl border border-red-500/50 bg-[#07140b] p-5 space-y-4 shadow-[0_0_20px_rgba(239,68,68,0.1)] relative">
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                  CRITICAL DISRUPTION
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">PORT OF SINGAPORE</h3>
                <span className="text-[11px] text-[#4e6e58]">Strategic Transshipment Chokepoint</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-red-400">82%</span>
                <span className="block text-[10px] text-[#87a894]">P(Disruption)</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-b border-[#143a22] py-3 text-center text-xs">
              <div>
                <span className="text-[10px] text-[#4e6e58]">Delay</span>
                <div className="font-bold text-red-400">+6.4 days</div>
              </div>
              <div>
                <span className="text-[10px] text-[#4e6e58]">Exposed Orders</span>
                <div className="font-bold text-amber-400">184 orders</div>
              </div>
              <div>
                <span className="text-[10px] text-[#4e6e58]">Revenue</span>
                <div className="font-bold text-[#00ff88]">₹1.84 Cr</div>
              </div>
            </div>

            {/* Why? Button & Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#4e6e58] font-bold">CAUSAL DRIVERS:</span>
                <button
                  onClick={() => setSelectedWhyDisruption('singapore')}
                  className="text-[10px] text-[#00ff88] hover:underline flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>WHY 82%?</span>
                </button>
              </div>
              <div className="space-y-1 text-[11px] text-[#87a894]">
                <div className="flex justify-between">
                  <span>Port Berth Congestion Index:</span>
                  <span className="text-white">+21%</span>
                </div>
                <div className="flex justify-between">
                  <span>AIS Feeder Dwell Spike:</span>
                  <span className="text-white">+14%</span>
                </div>
                <div className="flex justify-between">
                  <span>Monsoon Squall Weather Hazard:</span>
                  <span className="text-white">+12%</span>
                </div>
              </div>
            </div>

            {/* Card Actions */}
            <div className="flex items-center justify-between border-t border-[#143a22] pt-3 text-xs">
              <Link
                href="/command?trace=port-singapore"
                className="rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-3 py-1.5 text-xs text-[#00ff88] hover:bg-[#00ff88]/25 transition"
              >
                TRACE IMPACT
              </Link>
              <Link
                href="/scenarios"
                className="text-xs text-[#87a894] hover:text-white"
              >
                SIMULATE
              </Link>
              <Link
                href="/exposure"
                className="text-xs text-[#87a894] hover:text-white"
              >
                VIEW EXPOSURE
              </Link>
            </div>
          </div>

          {/* Card 2: Strait of Hormuz */}
          <div className="rounded-xl border border-amber-500/50 bg-[#07140b] p-5 space-y-4 relative">
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  HIGH DISRUPTION
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">STRAIT OF HORMUZ</h3>
                <span className="text-[11px] text-[#4e6e58]">Energy & Raw Material Corridor</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-amber-400">79%</span>
                <span className="block text-[10px] text-[#87a894]">P(Disruption)</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-b border-[#143a22] py-3 text-center text-xs">
              <div>
                <span className="text-[10px] text-[#4e6e58]">Delay</span>
                <div className="font-bold text-amber-400">+8.2 days</div>
              </div>
              <div>
                <span className="text-[10px] text-[#4e6e58]">Exposed Orders</span>
                <div className="font-bold text-amber-400">93 orders</div>
              </div>
              <div>
                <span className="text-[10px] text-[#4e6e58]">Revenue</span>
                <div className="font-bold text-[#00ff88]">₹1.20 Cr</div>
              </div>
            </div>

            {/* Why? Button & Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#4e6e58] font-bold">CAUSAL DRIVERS:</span>
                <button
                  onClick={() => setSelectedWhyDisruption('hormuz')}
                  className="text-[10px] text-[#00ff88] hover:underline flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>WHY 79%?</span>
                </button>
              </div>
              <div className="space-y-1 text-[11px] text-[#87a894]">
                <div className="flex justify-between">
                  <span>Naval Drill & Security Advisory:</span>
                  <span className="text-white">+28%</span>
                </div>
                <div className="flex justify-between">
                  <span>Tanker AIS Speed Reduction:</span>
                  <span className="text-white">+18%</span>
                </div>
                <div className="flex justify-between">
                  <span>Insurance War-Risk Surcharge:</span>
                  <span className="text-white">+15%</span>
                </div>
              </div>
            </div>

            {/* Card Actions */}
            <div className="flex items-center justify-between border-t border-[#143a22] pt-3 text-xs">
              <Link
                href="/command?trace=cp.strait_of_hormuz"
                className="rounded border border-[#143a22] bg-[#040806] px-3 py-1.5 text-xs text-[#87a894] hover:text-[#00ff88] hover:border-[#00ff88]/50 transition"
              >
                TRACE IMPACT
              </Link>
              <Link
                href="/scenarios"
                className="text-xs text-[#87a894] hover:text-white"
              >
                SIMULATE
              </Link>
              <Link
                href="/exposure"
                className="text-xs text-[#87a894] hover:text-white"
              >
                VIEW EXPOSURE
              </Link>
            </div>
          </div>

          {/* Card 3: Suez Canal / Red Sea Corridor */}
          <div className="rounded-xl border border-[#143a22] bg-[#07140b] p-5 space-y-4 relative">
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  HIGH DISRUPTION
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">SUEZ CANAL / RED SEA</h3>
                <span className="text-[11px] text-[#4e6e58]">Europe-Asia Maritime Trunk</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-amber-400">74%</span>
                <span className="block text-[10px] text-[#87a894]">P(Disruption)</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-b border-[#143a22] py-3 text-center text-xs">
              <div>
                <span className="text-[10px] text-[#4e6e58]">Delay</span>
                <div className="font-bold text-amber-400">+12.0 days</div>
              </div>
              <div>
                <span className="text-[10px] text-[#4e6e58]">Exposed Orders</span>
                <div className="font-bold text-amber-400">62 orders</div>
              </div>
              <div>
                <span className="text-[10px] text-[#4e6e58]">Revenue</span>
                <div className="font-bold text-[#00ff88]">₹98.0 L</div>
              </div>
            </div>

            {/* Why? Button & Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#4e6e58] font-bold">CAUSAL DRIVERS:</span>
                <button
                  onClick={() => setSelectedWhyDisruption('suez')}
                  className="text-[10px] text-[#00ff88] hover:underline flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>WHY 74%?</span>
                </button>
              </div>
              <div className="space-y-1 text-[11px] text-[#87a894]">
                <div className="flex justify-between">
                  <span>UKMTO Security Advisories:</span>
                  <span className="text-white">+31%</span>
                </div>
                <div className="flex justify-between">
                  <span>Cape of Good Hope Diversions:</span>
                  <span className="text-white">+24%</span>
                </div>
              </div>
            </div>

            {/* Card Actions */}
            <div className="flex items-center justify-between border-t border-[#143a22] pt-3 text-xs">
              <Link
                href="/command?trace=suez-canal"
                className="rounded border border-[#143a22] bg-[#040806] px-3 py-1.5 text-xs text-[#87a894] hover:text-[#00ff88] hover:border-[#00ff88]/50 transition"
              >
                TRACE IMPACT
              </Link>
              <Link
                href="/scenarios"
                className="text-xs text-[#87a894] hover:text-white"
              >
                SIMULATE
              </Link>
              <Link
                href="/exposure"
                className="text-xs text-[#87a894] hover:text-white"
              >
                VIEW EXPOSURE
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Why? Bayesian Explainability Modal (Section 15) */}
      {selectedWhyDisruption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#00ff88]/50 bg-[#040806] p-6 shadow-[0_0_30px_rgba(0,255,136,0.2)] font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#143a22] pb-3">
              <div>
                <span className="text-[10px] text-[#00ff88] font-bold">[BAYESIAN POSTERIOR EVOLUTION]</span>
                <h3 className="text-sm font-bold text-white uppercase mt-0.5">
                  {selectedWhyDisruption === 'singapore' ? 'PORT OF SINGAPORE' : selectedWhyDisruption === 'hormuz' ? 'STRAIT OF HORMUZ' : 'SUEZ CANAL'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedWhyDisruption(null)}
                className="text-[#4e6e58] hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-[#4e6e58] uppercase">Posterior Belief Progression:</span>
              <div className="space-y-1.5 bg-[#07140b] p-3 rounded border border-[#143a22]">
                <div className="flex justify-between items-center text-[#87a894]">
                  <span>Prior Baseline Probability:</span>
                  <span className="font-bold text-[#d1fae5]">18%</span>
                </div>
                <div className="flex justify-between items-center text-[#87a894]">
                  <span>+ Weather Hazard (Open-Meteo):</span>
                  <span className="font-bold text-[#d1fae5]">30% (+12%)</span>
                </div>
                <div className="flex justify-between items-center text-[#87a894]">
                  <span>+ Port Congestion Index (AIS Dwell):</span>
                  <span className="font-bold text-[#d1fae5]">51% (+21%)</span>
                </div>
                <div className="flex justify-between items-center text-[#87a894]">
                  <span>+ Feeder Shipping Anomaly:</span>
                  <span className="font-bold text-amber-400">67% (+16%)</span>
                </div>
                <div className="flex justify-between items-center text-[#87a894]">
                  <span>+ Regional Security Signal:</span>
                  <span className="font-bold text-amber-400">74% (+7%)</span>
                </div>
                <div className="flex justify-between items-center border-t border-[#143a22] pt-1.5 text-white font-bold">
                  <span>Current Posterior Probability:</span>
                  <span className="text-red-400">82%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-[#4e6e58] uppercase">Top Supporting Signals (Corroborated):</span>
              <div className="space-y-1.5 text-[11px] text-[#87a894]">
                <div className="flex justify-between border-b border-[#0e2716] pb-1">
                  <span>Port Berth Congestion Index (AIS)</span>
                  <span className="text-[#00ff88]">Confidence: 91%</span>
                </div>
                <div className="flex justify-between border-b border-[#0e2716] pb-1">
                  <span>Shipping Delay Anomaly (Spire Telemetry)</span>
                  <span className="text-[#00ff88]">Confidence: 87%</span>
                </div>
                <div className="flex justify-between border-b border-[#0e2716] pb-1">
                  <span>Monsoon Squall Advisory (ECMWF)</span>
                  <span className="text-[#00ff88]">Confidence: 68%</span>
                </div>
                <div className="flex justify-between">
                  <span>Maritime Security Incident Feed (GDACS)</span>
                  <span className="text-[#00ff88]">Confidence: 61%</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedWhyDisruption(null)}
                className="rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-3 py-1.5 text-xs text-[#00ff88] hover:bg-[#00ff88]/25 transition"
              >
                CLOSE EXPLAINABILITY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Network Health Methodology Modal (Section 17) */}
      {showHealthMethodology && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#00ff88]/50 bg-[#040806] p-6 shadow-[0_0_30px_rgba(0,255,136,0.2)] font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#143a22] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#00ff88]" />
                <span className="text-sm font-bold text-white uppercase">Network Health Breakdown</span>
              </div>
              <button
                onClick={() => setShowHealthMethodology(false)}
                className="text-[#4e6e58] hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#87a894] font-sans">
              Network health is computed as a weighted harmonic composite of five real-time operational dimensions:
            </p>

            <div className="space-y-2.5">
              <div className="flex justify-between border-b border-[#0e2716] pb-1.5">
                <span className="text-[#87a894]">Supply Continuity:</span>
                <span className="text-[#00ff88] font-bold">78 / 100</span>
              </div>
              <div className="flex justify-between border-b border-[#0e2716] pb-1.5">
                <span className="text-[#87a894]">Transport & Route Stability:</span>
                <span className="text-amber-400 font-bold">64 / 100</span>
              </div>
              <div className="flex justify-between border-b border-[#0e2716] pb-1.5">
                <span className="text-[#87a894]">Supplier Health & Capacity:</span>
                <span className="text-[#00ff88] font-bold">82 / 100</span>
              </div>
              <div className="flex justify-between border-b border-[#0e2716] pb-1.5">
                <span className="text-[#87a894]">Inventory Buffer Resilience:</span>
                <span className="text-amber-400 font-bold">59 / 100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#87a894]">External Disruption Pressure:</span>
                <span className="text-red-400 font-bold">51 / 100</span>
              </div>
            </div>

            <div className="border-t border-[#143a22] pt-3 flex justify-between items-center">
              <span className="font-bold text-white">Overall Network Score:</span>
              <span className="text-base font-bold text-[#00ff88]">71 / 100</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHealthMethodology(false)}
                className="rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-3 py-1.5 text-xs text-[#00ff88] hover:bg-[#00ff88]/25 transition"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Analyst Universal Modal */}
      <AIAnalystModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        defaultQuestion={aiPrompt}
      />
    </div>
  );
}
