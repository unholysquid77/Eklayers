'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Sparkles,
  Send,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Cpu,
  Box,
  AlertTriangle,
  FileText,
  Truck,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  History,
  RotateCcw,
} from 'lucide-react';
import { queryAIAnalyst } from '@/lib/api';
import type { AIQueryResponse, AICitation } from '@/lib/contracts';
import { MOCK_AI_RESPONSE } from '@/lib/mock';

interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  response: AIQueryResponse;
}

const PRESET_QUERIES = [
  {
    category: 'ACTIVE DISRUPTION',
    label: 'Singapore Disruption Impact',
    prompt: 'Explain what is happening in Singapore right now and how it impacts our production.',
  },
  {
    category: 'CUSTOMER EXPOSURE',
    label: 'SKU-441 & Order Exposure',
    prompt: 'Which customer orders are exposed to SKU-441 and what is the total revenue at risk?',
  },
  {
    category: 'CAUSAL REASONING',
    label: 'Bayesian Risk Shift',
    prompt: 'Why did SKU-441 risk jump from 42% to 78% over the past 48 hours?',
  },
  {
    category: 'SCENARIO & RESILIENCE',
    label: 'Supplier Alpha Total Failure',
    prompt: 'What happens if Supplier Alpha fails completely? Which product lines halt first?',
  },
  {
    category: 'MITIGATION & ROI',
    label: 'Optimal Mitigation Strategy',
    prompt: 'What is the cheapest way to prevent the most stockouts for the Singapore disruption?',
  },
  {
    category: 'EARLY WARNING',
    label: '14-Day Horizon Risk Scan',
    prompt: 'What latent disruptions are most likely to impact operations in the next 14 days?',
  },
];

export default function AIAnalystPage() {
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeResponse, setActiveResponse] = useState<AIQueryResponse>(MOCK_AI_RESPONSE);
  const [history, setHistory] = useState<QueryHistoryItem[]>([
    {
      id: 'init-1',
      query: 'Explain what is happening in Singapore right now and how it impacts our production.',
      timestamp: 'Just now',
      response: MOCK_AI_RESPONSE,
    },
  ]);

  const handleExecuteQuery = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;
    setLoading(true);

    try {
      const res = await queryAIAnalyst(trimmed);
      setActiveResponse(res);
      setHistory((prev) => [
        {
          id: `q-${Date.now()}`,
          query: trimmed,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          response: res,
        },
        ...prev.slice(0, 9),
      ]);
    } catch {
      setActiveResponse(MOCK_AI_RESPONSE);
    } finally {
      setLoading(false);
      setInputQuery('');
    }
  };

  const formatRupee = (amt: number) => {
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)} L`;
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  const getCitationLink = (cit: AICitation) => {
    switch (cit.entity_kind) {
      case 'sku':
        return `/exposure?sku=${cit.entity_id}`;
      case 'order':
        return `/exposure?order=${cit.entity_id}`;
      case 'chokepoint':
      case 'port':
        return `/command?focus=${cit.entity_id}`;
      case 'supplier':
        return `/suppliers?supplier=${cit.entity_id}`;
      default:
        return `/control-tower`;
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white p-4 sm:p-6 font-mono selection:bg-[#00e676]/30 selection:text-[#00e676]">
      {/* Header Banner */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#112818] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#00e676]/40 bg-[#00e676]/15 text-[#00e676]">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </span>
            <h1 className="text-xl font-black tracking-wider text-white">SARVADARSHI AI ANALYST</h1>
            <span className="rounded border border-[#00e676]/40 bg-[#00e676]/20 px-2 py-0.5 text-[10px] font-bold text-[#00e676]">
              EPIDEMIOLOGICAL REASONING ENGINE
            </span>
            <span className="rounded border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-[#87a894]">
              ZERO HALLUCINATION
            </span>
          </div>
          <p className="mt-1 text-xs text-[#87a894]">
            Fully grounded natural language synthesis directly coupled to Bayesian graph state, BOM dependencies, and Monte Carlo futures.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExecuteQuery(history[0]?.query || 'Explain what is happening in Singapore right now and how it impacts our production.')}
            disabled={loading}
            className="flex items-center gap-1.5 rounded border border-[#00e676]/60 bg-[#00e676]/20 px-3.5 py-1.5 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition-all disabled:opacity-50 "
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>REGENERATE INTELLIGENCE SYNTHESIS</span>
          </button>
          <button
            onClick={() => handleExecuteQuery('Explain what is happening in Singapore right now and how it impacts our production.')}
            className="flex items-center gap-1.5 rounded border border-[#112818] bg-[#020503] px-3 py-1.5 text-xs text-[#87a894] hover:border-[#00e676]/50 hover:text-white transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Baseline
          </button>
          <Link
            href="/scenarios"
            className="flex items-center gap-1.5 rounded border border-[#00e676]/40 bg-[#00e676]/10 px-3 py-1.5 text-xs font-semibold text-[#00e676] hover:bg-[#00e676]/20 transition-colors"
          >
            <Layers className="h-3.5 w-3.5" />
            Scenario Sandbox
          </Link>
        </div>
      </div>

      {/* Preset Query Grid */}
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PRESET_QUERIES.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => handleExecuteQuery(preset.prompt)}
            className="flex flex-col items-start rounded-lg border border-[#112818] bg-[#020503]/70 p-3 text-left transition-all hover:border-[#00e676]/50 hover:bg-[#0c2214] group"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#00e676]">
                {preset.category}
              </span>
              <ArrowRight className="h-3 w-3 text-[#87a894] transition-transform group-hover:translate-x-1 group-hover:text-[#00e676]" />
            </div>
            <div className="text-xs font-semibold text-white group-hover:text-[#00e676]">
              {preset.label}
            </div>
            <div className="mt-1 line-clamp-1 text-[10px] text-[#87a894]">
              {preset.prompt}
            </div>
          </button>
        ))}
      </div>

      {/* Main Grid: Query Console (Left/Top) + Response & Intelligence (Right/Bottom) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Input + Conversation Thread (4 cols) */}
        <div className="space-y-4 lg:col-span-4">
          {/* Active Query Box */}
          <div className="rounded-xl border border-[#112818] bg-[#020503] p-4 ">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#00e676]">
              Ask Operational Intelligence
            </label>
            <div className="relative">
              <textarea
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleExecuteQuery(inputQuery);
                  }
                }}
                placeholder="Ask about disruptions, SKUs, suppliers, delay quantiles, or mitigation ROI..."
                rows={4}
                className="w-full resize-none rounded-lg border border-[#112818] bg-[#000000] p-3 text-xs text-white placeholder-[#87a894]/50 focus:border-[#00e676] focus:outline-none focus:ring-1 focus:ring-[#00e676]"
              />
              <button
                onClick={() => handleExecuteQuery(inputQuery)}
                disabled={loading || !inputQuery.trim()}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded bg-[#00e676] px-3 py-1.5 text-xs font-bold text-black transition-all hover:bg-[#22c55e] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                ) : (
                  <>
                    <Send className="h-3 w-3" />
                    <span>ANALYZE</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-[#87a894]">
              Press <kbd className="rounded border border-[#112818] bg-black/50 px-1 py-0.5 text-white">Enter</kbd> to analyze. Synthesizes Bayesian graphs with deterministic BOM exposures.
            </p>
          </div>

          {/* Query Session History */}
          <div className="rounded-xl border border-[#112818] bg-[#020503] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#87a894]">
                <History className="h-3.5 w-3.5 text-[#00e676]" />
                SESSION INQUIRY LOG
              </span>
              <span className="text-[10px] text-[#87a894]">{history.length} Queries</span>
            </div>

            <div className="space-y-2">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setActiveResponse(h.response)}
                  className="w-full rounded-lg border border-[#112818] bg-[#000000] p-2.5 text-left transition-colors hover:border-[#00e676]/40 hover:bg-[#0c2214]"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#87a894]">
                    <span>QUERY</span>
                    <span>{h.timestamp}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-white">{h.query}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Grounded Analysis Answer & Live Citations (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
          {loading ? (
            <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-[#112818] bg-[#020503] p-8 text-center">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-[#00e676] border-t-transparent mb-4" />
              <div className="text-sm font-bold text-white tracking-wider">
                TRAVERSING BAYESIAN CAUSAL GRAPH
              </div>
              <p className="mt-1 text-xs text-[#87a894]">
                Propagating Singapore port stress &rarr; Route SHP-8821 &rarr; Supplier Alpha &rarr; Bill of Materials &rarr; Customer Orders...
              </p>
            </div>
          ) : activeResponse ? (
            <div className="space-y-6">
              {/* Executive Summary Card */}
              <div className="rounded-xl border border-[#00e676]/40 bg-[#020503] p-6  relative overflow-hidden">
                <div className="absolute right-0 top-0 h-24 w-24 bg-[#00e676]/5 blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between border-b border-[#112818] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[#00e676]/40 bg-[#00e676]/15 px-2 py-0.5 text-[10px] font-bold text-[#00e676]">
                      GROUNDED SYNTHESIS
                    </span>
                    <span className="text-[10px] text-[#87a894]">Timestamp: {activeResponse.as_of}</span>
                  </div>
                  <span className="text-[10px] text-[#87a894]">
                    Source: Epistemic Bayesian Engine v2.4
                  </span>
                </div>

                <div className="text-sm font-sans leading-relaxed text-[#d1fae5]">
                  <p className="text-sm font-normal leading-normal text-white">
                    {activeResponse.answer}
                  </p>
                </div>
              </div>

              {/* Key Quantitative Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-[#112818] bg-[#020503] p-3 text-center">
                  <div className="text-[10px] uppercase text-[#87a894]">Disruption Probability</div>
                  <div className="mt-1 text-lg font-black text-rose-400">
                    {Math.round(activeResponse.probability_pct)}%
                  </div>
                  <div className="text-[9px] text-[#87a894]">Bayesian Posterior</div>
                </div>

                <div className="rounded-lg border border-[#112818] bg-[#020503] p-3 text-center">
                  <div className="text-[10px] uppercase text-[#87a894]">Orders Exposed</div>
                  <div className="mt-1 text-lg font-black text-amber-400">
                    {activeResponse.orders_exposed} Orders
                  </div>
                  <div className="text-[9px] text-[#87a894]">Tier-1 Contracts</div>
                </div>

                <div className="rounded-lg border border-[#112818] bg-[#020503] p-3 text-center">
                  <div className="text-[10px] uppercase text-[#87a894]">Revenue at Risk</div>
                  <div className="mt-1 text-lg font-black text-[#00e676]">
                    {formatRupee(activeResponse.revenue_exposed_inr)}
                  </div>
                  <div className="text-[9px] text-[#87a894]">BOM Traced Exposure</div>
                </div>
              </div>

              {/* Latent Causal Drivers Chain */}
              {activeResponse.drivers && activeResponse.drivers.length > 0 && (
                <div className="rounded-xl border border-[#112818] bg-[#020503] p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#00e676]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                        Underlying Latent Drivers
                      </h3>
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-400">
                        [INFERRED]
                      </span>
                    </div>
                    <span className="text-[10px] text-[#87a894]">Multi-Tier Dependency Graph</span>
                  </div>

                  <div className="space-y-2">
                    {activeResponse.drivers.map((driver, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-lg border border-[#112818] bg-[#000000] p-3 text-xs"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00e676]/10 text-[10px] font-bold text-[#00e676]">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-gray-200">{driver}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Action & Expected Effect */}
              {activeResponse.recommended_action && (
                <div className="rounded-xl border border-[#00e676]/30 bg-[#00e676]/5 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#00e676]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                        Prescriptive Mitigation Recommendation
                      </h3>
                      <span className="rounded bg-[#00e676]/20 px-1.5 py-0.5 text-[9px] text-[#00e676]">
                        [SIMULATED]
                      </span>
                    </div>
                    <Link
                      href="/scenarios"
                      className="text-[10px] text-[#00e676] hover:underline flex items-center gap-1"
                    >
                      Open Comparison Matrix <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="rounded-lg border border-[#112818] bg-[#000000] p-3">
                    <div className="text-xs font-bold text-white mb-1">
                      {activeResponse.recommended_action}
                    </div>
                    {activeResponse.expected_effect && (
                      <div className="border-t border-[#112818] mt-2 pt-2 text-[11px] text-[#87a894]">
                        <strong className="text-[#22c55e]">Expected Outcome:</strong> {activeResponse.expected_effect}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Grounded Entity Deep-Links */}
              {activeResponse.citations && activeResponse.citations.length > 0 && (
                <div className="rounded-xl border border-[#112818] bg-[#020503] p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#87a894]">
                      Cited Entities & Deep Navigation
                    </span>
                    <span className="text-[10px] text-[#87a894]">Direct Graph Verification</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {activeResponse.citations.map((cit, idx) => (
                      <Link
                        key={idx}
                        href={getCitationLink(cit)}
                        className="flex items-center justify-between rounded-lg border border-[#112818] bg-[#000000] p-2.5 transition-colors hover:border-[#00e676]/50 hover:bg-[#0c2214] group"
                      >
                        <div className="min-w-0">
                          <div className="text-[9px] uppercase text-[#00e676]">{cit.entity_kind}</div>
                          <div className="truncate text-xs font-bold text-white group-hover:text-[#00e676]">
                            {cit.label}
                          </div>
                        </div>
                        <ExternalLink className="h-3 w-3 shrink-0 text-[#87a894] group-hover:text-[#00e676]" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
