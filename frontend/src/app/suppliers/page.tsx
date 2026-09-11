'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Truck,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRight,
  ExternalLink,
  Info,
  CheckCircle2,
  GitBranch,
} from 'lucide-react';
import { getSuppliersProfiles } from '@/lib/api';
import type { SupplierProfile } from '@/lib/contracts';
import { MOCK_SUPPLIERS } from '@/lib/mock';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>(MOCK_SUPPLIERS);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierProfile>(MOCK_SUPPLIERS[0]);
  const [simulatedSwitch, setSimulatedSwitch] = useState<string | null>(null);

  useEffect(() => {
    getSuppliersProfiles().then((res) => {
      if (res && res.length) setSuppliers(res);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#143a22] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#00ff88]/20 border border-[#00ff88]/40 px-2 py-0.5 text-[10px] text-[#00ff88]">
              [TIER-1 & TIER-2 VISIBILITY]
            </span>
            <span className="text-xs text-[#4e6e58]">SUPPLIER HEALTH, CONCENTRATION & DEPENDENCY</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wide text-white mt-1">
            SUPPLIER RISK & DEPENDENCY CENTER
          </h1>
          <p className="text-xs text-[#87a894] mt-0.5 font-sans">
            Continuous supplier vulnerability tracking, Herfindahl-Hirschman Index (HHI) concentration, and multi-tier sub-tier mapping.
          </p>
        </div>

        <Link
          href="/scenarios"
          className="flex items-center gap-2 rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-4 py-2 text-xs font-bold text-[#00ff88] hover:bg-[#00ff88]/25 shadow-[0_0_15px_rgba(0,255,136,0.15)] transition"
        >
          <Layers className="w-4 h-4" />
          <span>SIMULATE SUPPLIER FAILURE</span>
        </Link>
      </div>

      {/* Row 1: Concentration Risk & Single Points of Failure (Section 43 & 92) */}
      <div className="rounded-xl border border-amber-500/40 bg-[#07140b] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#143a22] pb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold uppercase text-white tracking-wider">
              CRITICAL SUPPLIER CONCENTRATION RISK (HHI INDEX)
            </h2>
          </div>
          <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
            HHI = 0.57 (HIGH MONOPOLY CONCENTRATION)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#040806] p-4 rounded-lg border border-[#143a22] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#87a894]">Monopolized Component:</span>
              <strong className="text-white">MCU-441 Microcontroller</strong>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#87a894]">Sole-Source Share:</span>
              <span className="text-red-400 font-bold">72% (Supplier Alpha)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#143a22] overflow-hidden">
              <div className="h-full bg-red-400" style={{ width: '72%' }} />
            </div>
            <div className="pt-2">
              <Link
                href="/scenarios"
                className="text-[11px] text-[#00ff88] hover:underline flex items-center gap-1"
              >
                <span>What breaks if Supplier Alpha fails?</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="bg-[#040806] p-4 rounded-lg border border-[#143a22] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#87a894]">EV Component:</span>
              <strong className="text-white">BMS Voltage Sense Array</strong>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#87a894]">Tier-1 Share:</span>
              <span className="text-amber-400 font-bold">81% (Beta Precision)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#143a22] overflow-hidden">
              <div className="h-full bg-amber-400" style={{ width: '81%' }} />
            </div>
            <div className="pt-2">
              <Link
                href="/scenarios"
                className="text-[11px] text-[#00ff88] hover:underline flex items-center gap-1"
              >
                <span>Simulate battery line stoppage</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="bg-[#040806] p-4 rounded-lg border border-[#143a22] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#87a894]">Subsea Interconnects:</span>
              <strong className="text-white">RF Transceiver Modules</strong>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#87a894]">Supplier Share:</span>
              <span className="text-[#00ff88] font-bold">64% (Gamma Packaging)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#143a22] overflow-hidden">
              <div className="h-full bg-[#00ff88]" style={{ width: '64%' }} />
            </div>
            <div className="pt-2">
              <Link
                href="/scenarios"
                className="text-[11px] text-[#00ff88] hover:underline flex items-center gap-1"
              >
                <span>Evaluate buffer runway</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Supplier Cards & Tier-2 Dependency View (Section 41 & 42) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Supplier Profiles (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="border-b border-[#143a22] pb-2">
            <span className="text-[10px] text-[#00ff88] font-bold uppercase">[TIER-1 SUPPLIERS]</span>
            <h2 className="text-xs font-bold uppercase text-white mt-0.5">
              ACTIVE STRATEGIC SUPPLIER REGISTRY
            </h2>
          </div>

          <div className="space-y-3">
            {suppliers.map((sup) => {
              const isSelected = selectedSupplier.id === sup.id;
              return (
                <div
                  key={sup.id}
                  onClick={() => setSelectedSupplier(sup)}
                  className={`rounded-xl border p-5 cursor-pointer transition space-y-3 ${
                    isSelected
                      ? 'border-[#00ff88] bg-[#00ff88]/10 shadow-[0_0_20px_rgba(0,255,136,0.15)]'
                      : 'border-[#143a22] bg-[#07140b] hover:border-[#00ff88]/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#00ff88]/20 px-2 py-0.5 text-[9px] font-bold text-[#00ff88]">
                          TIER {sup.tier} · {sup.country}
                        </span>
                        <span className="text-[10px] text-[#4e6e58]">{sup.region}</span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1">{sup.name}</h3>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xl font-black ${
                          sup.risk_score > 60
                            ? 'text-red-400'
                            : sup.risk_score > 40
                            ? 'text-amber-400'
                            : 'text-[#00ff88]'
                        }`}
                      >
                        {sup.risk_score} / 100
                      </span>
                      <span className="block text-[10px] text-red-400 font-bold">{sup.risk_velocity_7d}</span>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs border-t border-[#143a22] pt-3">
                    <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                      <span className="text-[9px] text-[#4e6e58]">On-Time Delivery</span>
                      <div className="font-bold text-white mt-0.5">{sup.on_time_delivery_pct}%</div>
                    </div>
                    <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                      <span className="text-[9px] text-[#4e6e58]">Quality PPM</span>
                      <div className="font-bold text-[#00ff88] mt-0.5">{sup.quality_pct}%</div>
                    </div>
                    <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                      <span className="text-[9px] text-[#4e6e58]">Capacity Util</span>
                      <div className="font-bold text-amber-400 mt-0.5">{sup.capacity_utilization_pct}%</div>
                    </div>
                    <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                      <span className="text-[9px] text-[#4e6e58]">Financial</span>
                      <div className="font-bold text-red-400 mt-0.5">{sup.financial_score}</div>
                    </div>
                  </div>

                  {/* Tier-2 summary */}
                  <div className="flex items-center justify-between text-xs text-[#87a894] border-t border-[#143a22] pt-2">
                    <span>Tier-2 Dependency: <strong className="text-white">{sup.tier2_name}</strong></span>
                    <span className="text-amber-400 font-bold">Risk: {sup.tier2_risk_score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tier-2 Deep Dive & Alternate Sourcing (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Tier-2 Visual Chain (Section 41) */}
          <div className="rounded-xl border border-[#143a22] bg-[#07140b] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#143a22] pb-2">
              <div className="flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-[#00ff88]" />
                <h3 className="text-xs font-bold uppercase text-white">
                  TIER-2 INFERRED DEPENDENCY GRAPH
                </h3>
              </div>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-400">
                INFERRED DEPENDENCY
              </span>
            </div>

            {/* Tree View */}
            <div className="space-y-3 bg-[#040806] p-4 rounded-lg border border-[#143a22] text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#00ff88]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#00ff88]">
                  TIER 1
                </span>
                <strong className="text-white">{selectedSupplier.name}</strong>
              </div>
              <div className="pl-4 text-[#4e6e58]">↓ supplies component</div>

              <div className="flex items-center gap-2 pl-3">
                <span className="rounded bg-[#38bdf8]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#38bdf8]">
                  PART
                </span>
                <strong className="text-white">MCU-441 Automotive Microcontroller</strong>
              </div>
              <div className="pl-7 text-[#4e6e58]">↓ manufactured at</div>

              <div className="flex items-center gap-2 pl-6">
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                  TIER 2
                </span>
                <strong className="text-red-400">{selectedSupplier.tier2_name}</strong>
              </div>
              <div className="pl-10 text-[#4e6e58]">↓ raw input</div>

              <div className="flex items-center gap-2 pl-9">
                <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-400">
                  MATERIAL
                </span>
                <span className="text-[#87a894]">300mm Silicon Wafers (GlobalWafers)</span>
              </div>
            </div>

            {/* Risk Breakdown */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                <span className="text-[9px] text-[#4e6e58]">Direct Risk</span>
                <div className="font-bold text-[#d1fae5] mt-0.5">24%</div>
              </div>
              <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                <span className="text-[9px] text-amber-400">Indirect Risk</span>
                <div className="font-bold text-amber-400 mt-0.5">71%</div>
              </div>
              <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                <span className="text-[9px] text-red-400">Combined</span>
                <div className="font-bold text-red-400 mt-0.5">83%</div>
              </div>
            </div>
          </div>

          {/* Alternative Sourcing Simulator (Section 44) */}
          <div className="rounded-xl border border-[#00ff88]/40 bg-[#07140b] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#143a22] pb-2">
              <span className="text-[10px] text-[#00ff88] font-bold uppercase">[ALTERNATIVE SOURCING]</span>
              <span className="text-[10px] text-[#4e6e58]">APPROVED SECOND SOURCES</span>
            </div>

            <p className="text-xs text-[#87a894] font-sans">
              Qualified dual-sourcing alternatives for components sourced from {selectedSupplier.name}:
            </p>

            {selectedSupplier.alternatives && selectedSupplier.alternatives.length > 0 ? (
              <div className="space-y-3">
                {selectedSupplier.alternatives.map((alt) => (
                  <div
                    key={alt.supplier_id}
                    className="bg-[#040806] p-3.5 rounded-lg border border-[#143a22] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-white">{alt.name}</strong>
                      <span className="text-[#00ff88] font-bold">Risk: {alt.risk_score}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-[#87a894]">
                      <div>Capacity: <strong className="text-white">{alt.capacity_pct}%</strong></div>
                      <div>Lead Time: <strong className="text-white">{alt.lead_time_days}d</strong></div>
                      <div>Cost Delta: <strong className="text-amber-400">+{alt.cost_delta_pct}%</strong></div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => setSimulatedSwitch(alt.supplier_id)}
                        className={`rounded px-3 py-1 text-xs font-bold transition ${
                          simulatedSwitch === alt.supplier_id
                            ? 'bg-[#00ff88] text-black'
                            : 'border border-[#00ff88]/50 bg-[#00ff88]/15 text-[#00ff88] hover:bg-[#00ff88]/25'
                        }`}
                      >
                        {simulatedSwitch === alt.supplier_id ? '✓ SWITCH SIMULATED' : 'SIMULATE SWITCH'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-[#87a894]">
                No second-source contracts currently pre-qualified for this vendor.
              </div>
            )}

            {simulatedSwitch && (
              <div className="rounded border border-[#00ff88]/40 bg-[#00ff88]/10 p-3 text-[11px] text-[#d1fae5] space-y-1 animate-in fade-in">
                <span className="font-bold text-[#00ff88]">SIMULATION IMPACT:</span>
                <p className="font-sans">
                  Switching 40% volume to Renesas partner reduces HHI concentration from <strong>0.57 → 0.38</strong>, insulates against Singapore transshipment bottleneck, and compresses stockout probability to <strong>14%</strong>.
                </p>
                <div className="pt-2">
                  <Link href="/scenarios" className="text-xs text-[#00ff88] underline font-bold">
                    Go to Planning Workspace →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
