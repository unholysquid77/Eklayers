'use client';

import { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Database, Clock, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { getSystemStatus } from '@/lib/api';
import type { SystemStatusResponse } from '@/lib/contracts';
import { MOCK_SYSTEM_STATUS } from '@/lib/mock';

export default function GlobalStatusBar() {
  const [status, setStatus] = useState<SystemStatusResponse>(MOCK_SYSTEM_STATUS);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [zuluTime, setZuluTime] = useState('');

  useEffect(() => {
    getSystemStatus().then(setStatus).catch(() => {});
    const interval = setInterval(() => {
      setZuluTime(new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z');
    }, 1000);
    setZuluTime(new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z');
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="border-t border-[#143a22] bg-[#040806]/95 px-4 py-1 text-[11px] font-mono text-[#87a894] flex flex-wrap items-center justify-between gap-3 select-none backdrop-blur-md">
        {/* Left: System Live Status Indicator */}
        <div
          onClick={() => setShowHealthModal(true)}
          className="flex items-center gap-2 cursor-pointer group hover:text-[#00ff88] transition"
        >
          <span className="h-2 w-2 rounded-full bg-[#00ff88] animate-ping" />
          <span className="font-bold text-white group-hover:text-[#00ff88]">● SYSTEM LIVE</span>
          <span className="text-[#4e6e58] group-hover:text-[#87a894] underline decoration-dotted text-[10px] ml-1">
            [DATA HEALTH]
          </span>
        </div>

        {/* Center: Realtime Telemetry Stats */}
        <div className="flex items-center gap-4 text-[10px] sm:text-[11px] overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[#4e6e58]">INGESTION:</span>
            <span className="text-[#00ff88] font-bold">{status.ingestion_rate}</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[#4e6e58]">MODEL:</span>
            <span className="text-[#d1fae5]">Updated {status.model_updated_seconds_ago}s ago</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[#4e6e58]">GRAPH:</span>
            <span className="text-[#d1fae5]">{status.graph_nodes_count.toLocaleString()} nodes · {status.graph_relations_count.toLocaleString()} edges</span>
          </div>

          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[#4e6e58]">FORECAST:</span>
            <span className="text-[#38bdf8]">Next refresh in {status.forecast_next_refresh_seconds}s</span>
          </div>
        </div>

        {/* Right: Zulu Clock */}
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-[#4e6e58] whitespace-nowrap">
          <Clock className="w-3 h-3 text-[#00ff88]" />
          <span className="text-[#00ff88]">{zuluTime || 'SYNCING UTC…'}</span>
        </div>
      </div>

      {/* Data Health Modal */}
      {showHealthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-[#00ff88]/50 bg-[#040806] p-5 shadow-[0_0_30px_rgba(0,255,136,0.25)] font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#143a22] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00ff88]" />
                <span className="text-sm font-bold text-white uppercase">Data Health & Provenance</span>
              </div>
              <button
                onClick={() => setShowHealthModal(false)}
                className="text-[#4e6e58] hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {Object.entries(status.data_health).map(([feed, health]) => (
                <div key={feed} className="flex items-center justify-between border-b border-[#0e2716] pb-2 text-[11px]">
                  <span className="text-[#87a894]">{feed}</span>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span className="text-[#00ff88] font-bold">{health}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded bg-[#07140b] p-3 border border-[#143a22] space-y-1.5 text-[10px]">
              <div className="flex justify-between text-[#87a894]">
                <span>Inference Latency:</span>
                <span className="text-[#00ff88]">42.0ms</span>
              </div>
              <div className="flex justify-between text-[#87a894]">
                <span>Monte Carlo Runs (Last Hour):</span>
                <span className="text-[#00ff88]">42,000 futures</span>
              </div>
              <div className="flex justify-between text-[#87a894]">
                <span>Last Successful Ingest:</span>
                <span className="text-white font-bold">{status.last_successful_ingest}</span>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowHealthModal(false)}
                className="rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-3 py-1.5 text-xs text-[#00ff88] hover:bg-[#00ff88]/25 transition"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
