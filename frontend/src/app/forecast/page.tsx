'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Globe2,
  Calendar,
  Layers,
  ChevronRight,
  Activity,
  Info,
} from 'lucide-react';
import { getShipments } from '@/lib/api';
import type { ShipmentItem } from '@/lib/contracts';
import { MOCK_SHIPMENTS } from '@/lib/mock';

const CHOKEPOINT_RANKINGS = [
  {
    id: 'port-singapore',
    name: 'PORT OF SINGAPORE',
    category: 'Transshipment Hub',
    current_stress: 82,
    trend_pct: 21,
    peak_30d: 89,
    affected_suppliers: 12,
    affected_orders: 184,
    status: 'CRITICAL',
  },
  {
    id: 'cp.strait_of_hormuz',
    name: 'STRAIT OF HORMUZ',
    category: 'Maritime Lane',
    current_stress: 78,
    trend_pct: 12,
    peak_30d: 84,
    affected_suppliers: 9,
    affected_orders: 117,
    status: 'CRITICAL',
  },
  {
    id: 'suez-canal',
    name: 'SUEZ CANAL & BAB EL-MANDEB',
    category: 'Canal Trunk',
    current_stress: 74,
    trend_pct: 15,
    peak_30d: 79,
    affected_suppliers: 6,
    affected_orders: 62,
    status: 'HIGH',
  },
  {
    id: 'panama-canal',
    name: 'PANAMA CANAL LOCKS',
    category: 'Canal Trunk',
    current_stress: 61,
    trend_pct: -3,
    peak_30d: 64,
    affected_suppliers: 4,
    affected_orders: 41,
    status: 'MEDIUM',
  },
  {
    id: 'cp.taiwan_strait',
    name: 'TAIWAN STRAIT',
    category: 'Maritime Lane',
    current_stress: 58,
    trend_pct: 8,
    peak_30d: 68,
    affected_suppliers: 7,
    affected_orders: 53,
    status: 'MEDIUM',
  },
];

export default function ForecastPage() {
  const [shipments, setShipments] = useState<ShipmentItem[]>(MOCK_SHIPMENTS);

  useEffect(() => {
    getShipments().then(setShipments).catch(() => {});
  }, []);

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#143a22] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 text-[10px] text-purple-400">
              [PREDICTED + MODEL DERIVED]
            </span>
            <span className="text-xs text-[#4e6e58]">30-DAY PROBABILISTIC FORECAST HORIZON</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wide text-white mt-1">
            DISRUPTION & ARRIVAL FORECAST CENTER
          </h1>
          <p className="text-xs text-[#87a894] mt-0.5 font-sans">
            Continuous Bayesian belief evolution, Monte Carlo lead-time distributions, and network stress projections.
          </p>
        </div>

        {/* Forecast Confidence Badge (Section 27) */}
        <div className="flex items-center gap-3 rounded-lg border border-[#00ff88]/40 bg-[#07140b] p-3 shadow-[0_0_15px_rgba(0,255,136,0.1)]">
          <ShieldCheck className="w-5 h-5 text-[#00ff88]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">MODEL CONFIDENCE:</span>
              <span className="text-xs font-black text-[#00ff88]">HIGH (88%)</span>
            </div>
            <p className="text-[10px] text-[#87a894]">Based on 18 historical analogues & 7 independent signal streams</p>
          </div>
        </div>
      </div>

      {/* Row 1: Forecast Trajectories & Stockout Curve (Section 26 & 24) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Disruption Probability 30-Day Trajectory (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-[#143a22] bg-[#07140b] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#143a22] pb-2">
            <div>
              <span className="text-[10px] text-purple-400 font-bold uppercase">[FORECAST TRAJECTORY]</span>
              <h2 className="text-xs font-bold uppercase text-white mt-0.5">
                30-DAY LATENT NETWORK STRESS PROJECTION
              </h2>
            </div>
            <span className="text-[10px] text-[#4e6e58]">P(DISRUPTION) OVER TIME</span>
          </div>

          {/* Graphical Trajectory Visualization */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between text-xs text-[#87a894]">
              <span>Current: <strong className="text-amber-400">58%</strong></span>
              <span>10-Day: <strong className="text-red-400">71%</strong></span>
              <span>20-Day: <strong className="text-red-400">82%</strong></span>
              <span>30-Day Peak: <strong className="text-red-400">89%</strong></span>
            </div>

            {/* Ascending Trajectory Bars */}
            <div className="grid grid-cols-6 gap-2 items-end h-32 pt-4 bg-[#040806] p-3 rounded-lg border border-[#143a22]">
              <div className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[9px] text-[#87a894]">58%</span>
                <div className="w-full bg-[#00ff88]" style={{ height: '58%' }} />
                <span className="text-[9px] text-[#4e6e58]">Day 0</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[9px] text-amber-400">64%</span>
                <div className="w-full bg-amber-400" style={{ height: '64%' }} />
                <span className="text-[9px] text-[#4e6e58]">Day 6</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[9px] text-red-400">71%</span>
                <div className="w-full bg-red-400" style={{ height: '71%' }} />
                <span className="text-[9px] text-[#4e6e58]">Day 12</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[9px] text-red-400">78%</span>
                <div className="w-full bg-red-400" style={{ height: '78%' }} />
                <span className="text-[9px] text-[#4e6e58]">Day 18</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[9px] text-red-400">84%</span>
                <div className="w-full bg-red-400" style={{ height: '84%' }} />
                <span className="text-[9px] text-[#4e6e58]">Day 24</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[9px] text-red-400 font-bold">89%</span>
                <div className="w-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" style={{ height: '89%' }} />
                <span className="text-[9px] text-red-400 font-bold">Day 30</span>
              </div>
            </div>

            <p className="text-[11px] text-[#87a894] font-sans">
              Model predicts peak disruption probability on <strong>Day 28–30</strong> as monsoon squalls intersect with container dwell spikes at Singapore and Tanjung Pelepas anchorages.
            </p>
          </div>
        </div>

        {/* Stockout Probability Horizon (Section 24) (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-[#143a22] bg-[#07140b] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#143a22] pb-2">
            <div>
              <span className="text-[10px] text-red-400 font-bold uppercase">[STOCKOUT HORIZON]</span>
              <h2 className="text-xs font-bold uppercase text-white mt-0.5">
                CUMULATIVE STOCKOUT PROBABILITY
              </h2>
            </div>
            <span className="text-[10px] text-[#4e6e58]">UNMITIGATED</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#87a894]">Stockout before Day 7:</span>
                <span className="text-[#00ff88] font-bold">12%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#143a22] overflow-hidden">
                <div className="h-full bg-[#00ff88]" style={{ width: '12%' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#87a894]">Stockout before Day 14 (Critical Window):</span>
                <span className="text-red-400 font-bold">78%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#143a22] overflow-hidden">
                <div className="h-full bg-red-400" style={{ width: '78%' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#87a894]">Stockout before Day 21:</span>
                <span className="text-red-400 font-bold">91%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#143a22] overflow-hidden">
                <div className="h-full bg-red-400" style={{ width: '91%' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#87a894]">Stockout before Day 30:</span>
                <span className="text-red-400 font-bold">96%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#143a22] overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: '96%' }} />
              </div>
            </div>

            <div className="rounded border border-red-500/40 bg-red-500/10 p-3 mt-4 text-[11px] text-[#d1fae5] space-y-1">
              <span className="font-bold text-red-400 uppercase text-[10px]">Operational Insight:</span>
              <p className="font-sans">
                Without expediting or inventory transfer, the first line stoppage will occur on <strong>Day 11 (SKU-441)</strong>, followed by <strong>Day 14 (SKU-782)</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Strategic Chokepoint Risk Rankings (Section 28) */}
      <div className="rounded-xl border border-[#143a22] bg-[#07140b] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#143a22] pb-2">
          <div>
            <span className="text-[10px] text-[#00ff88] font-bold uppercase">[CHOKEPOINT RANKINGS]</span>
            <h2 className="text-sm font-bold uppercase text-white mt-0.5">
              GLOBAL STRATEGIC BOTTLENECKS (30-DAY OUTLOOK)
            </h2>
          </div>
          <Link
            href="/command"
            className="text-xs font-bold text-[#00ff88] hover:underline flex items-center gap-1"
          >
            <span>VIEW CHOKEPOINTS ON GLOBE</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#143a22] bg-[#040806] text-[#4e6e58] text-[10px] uppercase tracking-wider">
                <th className="p-3">Chokepoint Node</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Current Stress</th>
                <th className="p-3 text-right">7-Day Trend</th>
                <th className="p-3 text-right">30D Peak Forecast</th>
                <th className="p-3 text-right">Exposed Suppliers</th>
                <th className="p-3 text-right">Exposed Orders</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0e2716]">
              {CHOKEPOINT_RANKINGS.map((cp) => (
                <tr key={cp.id} className="hover:bg-[#00ff88]/5 transition">
                  <td className="p-3 font-bold text-white">{cp.name}</td>
                  <td className="p-3 text-[#87a894]">{cp.category}</td>
                  <td className="p-3 text-right">
                    <span
                      className={`font-bold ${
                        cp.current_stress > 75
                          ? 'text-red-400'
                          : cp.current_stress > 60
                          ? 'text-amber-400'
                          : 'text-[#00ff88]'
                      }`}
                    >
                      {cp.current_stress}%
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className={cp.trend_pct > 0 ? 'text-red-400 font-bold' : 'text-[#00ff88]'}>
                      {cp.trend_pct > 0 ? `▲ +${cp.trend_pct}%` : `▼ ${cp.trend_pct}%`}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold text-red-400">{cp.peak_30d}%</td>
                  <td className="p-3 text-right text-white">{cp.affected_suppliers}</td>
                  <td className="p-3 text-right text-[#00ff88] font-bold">{cp.affected_orders}</td>
                  <td className="p-3 text-center">
                    <Link
                      href={`/command?trace=${cp.id}`}
                      className="rounded border border-[#00ff88]/40 bg-[#00ff88]/10 px-2.5 py-1 text-[10px] text-[#00ff88] hover:bg-[#00ff88]/20 transition"
                    >
                      TRACE ON GLOBE
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Shipment ETA Uncertainty Distributions (Section 25) */}
      <div className="space-y-4">
        <div className="border-b border-[#143a22] pb-2">
          <span className="text-[10px] text-[#38bdf8] font-bold uppercase">[LOGISTICS UNCERTAINTY]</span>
          <h2 className="text-sm font-bold uppercase text-white mt-0.5">
            SHIPMENT ETA PROBABILISTIC DISTRIBUTIONS (P50 / P90 / P99)
          </h2>
          <p className="text-xs text-[#87a894] font-sans">
            Continuous Bayesian update incorporating weather, AIS dwell telemetry, and port congestion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {shipments.map((shp) => (
            <div
              key={shp.id}
              className="rounded-xl border border-[#143a22] bg-[#07140b] p-5 space-y-4 relative"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded bg-[#00ff88]/20 border border-[#00ff88]/40 px-2 py-0.5 text-[9px] font-bold text-[#00ff88]">
                    {shp.carrier}
                  </span>
                  <h3 className="text-base font-bold text-white mt-1.5">{shp.id}</h3>
                  <span className="text-[11px] text-[#87a894]">{shp.origin} → {shp.destination}</span>
                </div>
                <div className="text-right">
                  <span
                    className={`text-lg font-black ${
                      shp.p_late > 0.6 ? 'text-red-400' : 'text-[#00ff88]'
                    }`}
                  >
                    {Math.round(shp.p_late * 100)}%
                  </span>
                  <span className="block text-[9px] text-[#4e6e58]">P(Late)</span>
                </div>
              </div>

              {/* Status & Chokepoint */}
              <div className="text-xs bg-[#040806] p-3 rounded border border-[#143a22] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#4e6e58]">Status:</span>
                  <span className="text-red-400 font-bold">{shp.current_status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#4e6e58]">Primary Risk:</span>
                  <span className="text-amber-400">{shp.primary_risk_chokepoint}</span>
                </div>
              </div>

              {/* ETA Distribution Quantiles */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-[#4e6e58] uppercase">Quantile Arrival Forecast:</span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                    <span className="text-[9px] text-[#4e6e58]">P50 (Median)</span>
                    <div className="font-bold text-white mt-0.5">{shp.p50_eta}</div>
                  </div>
                  <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                    <span className="text-[9px] text-amber-400">P90 (Worst 10%)</span>
                    <div className="font-bold text-amber-400 mt-0.5">{shp.p90_eta}</div>
                  </div>
                  <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                    <span className="text-[9px] text-red-400">P99 (Extreme)</span>
                    <div className="font-bold text-red-400 mt-0.5">{shp.p99_eta}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t border-[#143a22] pt-3 text-xs">
                <Link
                  href="/command"
                  className="text-xs text-[#00ff88] hover:underline"
                >
                  TRACE ROUTE
                </Link>
                <Link
                  href="/scenarios"
                  className="rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-3 py-1 text-xs text-[#00ff88] hover:bg-[#00ff88]/25 transition"
                >
                  EXPEDITE
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
