'use client';
import React from 'react';
import { Layers, Cpu, Box, Factory } from 'lucide-react';

interface TierNode {
  id: string;
  name: string;
  tier: number;
  category: string;
  criticality: number;
  riskScore: number;
  subNodes?: TierNode[];
}

interface TierTwoGraphProps {
  supplierId: string;
  supplierName?: string;
  supplierRiskScore: number;
}

export default function TierTwoGraph({
  supplierId,
  supplierName = 'Supplier Node',
  supplierRiskScore,
}: TierTwoGraphProps) {
  const tree: TierNode = {
    id: supplierId,
    name: supplierName,
    tier: 1,
    category: 'Primary Contract Manufacturer',
    criticality: 0.9,
    riskScore: supplierRiskScore,
    subNodes: [
      {
        id: `${supplierId}-part-1`,
        name: 'Advanced ASIC / MCU Controller',
        tier: 2,
        category: 'Key BOM Component',
        criticality: 0.95,
        riskScore: Math.min(100, supplierRiskScore + 12),
        subNodes: [
          {
            id: `${supplierId}-sub-1`,
            name: 'TSMC Sub-Fab 14 (Silicon Wafers)',
            tier: 3,
            category: 'Tier-2 Sub-Supplier',
            criticality: 0.92,
            riskScore: 78,
          },
          {
            id: `${supplierId}-sub-2`,
            name: 'Tokyo Electron (Etch Precursors)',
            tier: 3,
            category: 'Tier-2 Sub-Supplier',
            criticality: 0.85,
            riskScore: 45,
          },
        ],
      },
      {
        id: `${supplierId}-part-2`,
        name: 'Multi-layer Ceramic Capacitors',
        tier: 2,
        category: 'Passive Component',
        criticality: 0.70,
        riskScore: Math.max(15, supplierRiskScore - 10),
        subNodes: [
          {
            id: `${supplierId}-sub-3`,
            name: 'Murata Manufacturing (Dielectrics)',
            tier: 3,
            category: 'Tier-2 Sub-Supplier',
            criticality: 0.65,
            riskScore: 32,
          },
        ],
      },
    ],
  };

  const getBadgeCls = (score: number) => {
    if (score >= 70) return 'text-red-400 bg-red-950/60 border-red-800';
    if (score >= 45) return 'text-amber-400 bg-amber-950/60 border-amber-800';
    return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
  };

  return (
    <div className="p-4 bg-slate-900/70 border border-slate-700/60 rounded-lg">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="hud-text text-xs font-bold text-cyan-400">TIER-2 MULTI-HOP DEPENDENCY TREE</span>
        </div>
        <span className="text-[10px] text-slate-400 hud-text">PS #9 BONUS: 2-LEVEL VISIBILITY</span>
      </div>

      <div className="space-y-4">
        {/* Tier 1 Primary Supplier */}
        <div className="p-3 rounded bg-slate-800/80 border border-cyan-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Factory className="w-5 h-5 text-amber-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-100">{tree.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">TIER-1</span>
              </div>
              <div className="text-[10px] text-slate-400">{tree.category} · ID: {tree.id}</div>
            </div>
          </div>
          <div className={`text-xs font-bold px-2 py-1 rounded border hud-text ${getBadgeCls(tree.riskScore)}`}>
            RISK: {Math.round(tree.riskScore)}
          </div>
        </div>

        {/* Downstream Sub-Nodes */}
        <div className="pl-6 border-l-2 border-dashed border-slate-700 space-y-4 ml-4">
          {tree.subNodes?.map((part) => (
            <div key={part.id} className="space-y-3">
              <div className="p-2.5 rounded bg-slate-800/50 border border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">{part.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/50">BOM PART</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Criticality: {(part.criticality * 100).toFixed(0)}%</div>
                  </div>
                </div>
                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border hud-text ${getBadgeCls(part.riskScore)}`}>
                  {Math.round(part.riskScore)}
                </div>
              </div>

              {/* Sub-tier 2 Sub-Suppliers */}
              <div className="pl-6 border-l-2 border-dotted border-slate-700 space-y-2 ml-3">
                {part.subNodes?.map((sub) => (
                  <div key={sub.id} className="p-2 rounded bg-slate-800/30 border border-slate-700/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Box className="w-3.5 h-3.5 text-purple-400" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-slate-300">{sub.name}</span>
                          <span className="text-[8px] px-1 rounded bg-purple-950 text-purple-300 border border-purple-800">TIER-2 SUB-DEP</span>
                        </div>
                        <div className="text-[9px] text-slate-400">{sub.category}</div>
                      </div>
                    </div>
                    <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded border hud-text ${getBadgeCls(sub.riskScore)}`}>
                      RISK: {sub.riskScore}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

