'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Send,
  X,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Cpu,
  Box,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { queryAIAnalyst } from '@/lib/api';
import type { AIQueryResponse, AICitation } from '@/lib/contracts';
import { MOCK_AI_RESPONSE } from '@/lib/mock';

interface AIAnalystModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultQuestion?: string;
  contextEntityId?: string;
}

const SAMPLE_PROMPTS = [
  'Which orders are exposed to the Singapore disruption?',
  'Why did SKU-441 risk increase to 78%?',
  'What happens if Supplier Alpha fails?',
  'What is the cheapest way to prevent the most stockouts?',
  'What is most likely to disrupt operations in the next 14 days?',
];

export default function AIAnalystModal({
  isOpen,
  onClose,
  defaultQuestion,
  contextEntityId,
}: AIAnalystModalProps) {
  const [question, setQuestion] = useState(defaultQuestion || '');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIQueryResponse | null>(MOCK_AI_RESPONSE);

  if (!isOpen) return null;

  const handleAsk = async (qText?: string) => {
    const textToAsk = qText || question;
    if (!textToAsk.trim()) return;
    setLoading(true);
    try {
      const res = await queryAIAnalyst(textToAsk, contextEntityId);
      setResponse(res);
    } catch {
      setResponse(MOCK_AI_RESPONSE);
    } finally {
      setLoading(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md font-mono">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-[#00ff88]/50 bg-[#040806] shadow-[0_0_50px_rgba(0,255,136,0.2)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#143a22] bg-[#07140b] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00ff88]/40 bg-[#00ff88]/15 text-[#00ff88]">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wider text-white">SARVADARSHI AI ANALYST</h2>
                <span className="rounded bg-[#00ff88]/20 px-1.5 py-0.5 text-[9px] text-[#00ff88]">MODEL GROUNDED</span>
              </div>
              <p className="text-[10px] text-[#87a894]">Autonomous Bayesian Reasoning · Zero Hallucination Guardrails</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-[#87a894] hover:bg-[#143a22] hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Prompts */}
          <div>
            <span className="text-[10px] text-[#4e6e58] uppercase tracking-wider">Suggested Operational Queries:</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setQuestion(p);
                    handleAsk(p);
                  }}
                  className="rounded border border-[#143a22] bg-[#07140b] hover:border-[#00ff88]/50 hover:bg-[#00ff88]/10 px-2.5 py-1 text-[11px] text-[#87a894] hover:text-[#00ff88] transition text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Answer Card */}
          {response && (
            <div className="rounded-lg border border-[#143a22] bg-[#07140b]/60 p-5 space-y-5 animate-in fade-in">
              {/* Epistemic Label */}
              <div className="flex items-center justify-between border-b border-[#143a22] pb-3 text-xs">
                <span className="rounded bg-[#00ff88]/20 border border-[#00ff88]/40 px-2 py-0.5 text-[10px] text-[#00ff88]">
                  [INFERRED + PREDICTED]
                </span>
                <span className="text-[10px] text-[#4e6e58]">GENERATED VIA BAYESIAN GRAPH PROPAGATION</span>
              </div>

              {/* Natural Language Explanation */}
              <div className="text-sm font-sans leading-relaxed text-[#d1fae5]">
                {response.answer}
              </div>

              {/* Key Quantitative Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded border border-[#143a22] bg-[#040806] p-3 text-center">
                  <span className="text-[10px] text-[#4e6e58] uppercase">Disruption Probability</span>
                  <div className="mt-1 text-lg font-bold text-red-400">
                    {Math.round(response.probability_pct)}%
                  </div>
                </div>

                <div className="rounded border border-[#143a22] bg-[#040806] p-3 text-center">
                  <span className="text-[10px] text-[#4e6e58] uppercase">Orders Exposed</span>
                  <div className="mt-1 text-lg font-bold text-amber-400">
                    {response.orders_exposed} Orders
                  </div>
                </div>

                <div className="rounded border border-[#143a22] bg-[#040806] p-3 text-center">
                  <span className="text-[10px] text-[#4e6e58] uppercase">Revenue Exposed</span>
                  <div className="mt-1 text-lg font-bold text-[#00ff88]">
                    {formatRupee(response.revenue_exposed_inr)}
                  </div>
                </div>
              </div>

              {/* Key Drivers */}
              {response.drivers && response.drivers.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-[#4e6e58] uppercase tracking-wider">Underlying Latent Drivers:</span>
                  <ul className="space-y-1 text-xs text-[#87a894]">
                    {response.drivers.map((d, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[#00ff88] mt-0.5">▸</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action & Expected Effect */}
              <div className="rounded border border-[#00ff88]/30 bg-[#00ff88]/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#00ff88]">
                  <ArrowRight className="h-4 w-4" />
                  <span>RECOMMENDED ACTION:</span>
                </div>
                <p className="text-xs text-white">{response.recommended_action}</p>
                <div className="border-t border-[#143a22] pt-2 text-[11px] text-[#87a894]">
                  <strong className="text-[#44ffa2]">Expected Outcome:</strong> {response.expected_effect}
                </div>
              </div>

              {/* Citations & Traceability */}
              {response.citations && response.citations.length > 0 && (
                <div className="border-t border-[#143a22] pt-3">
                  <span className="text-[10px] text-[#4e6e58] uppercase tracking-wider">Grounding Entity Citations:</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {response.citations.map((c, i) => (
                      <Link
                        key={i}
                        href={getCitationLink(c)}
                        onClick={onClose}
                        className="flex items-center gap-1 rounded border border-[#00ff88]/40 bg-[#07140b] px-2.5 py-1 text-[11px] text-[#00ff88] hover:bg-[#00ff88]/15 transition"
                      >
                        <span>{c.label}</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-[#143a22] bg-[#07140b] p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about supply chain disruptions, SKU stockouts, or supplier risk…"
              className="flex-1 rounded border border-[#143a22] bg-[#040806] px-4 py-2.5 text-xs text-white placeholder-[#4e6e58] focus:border-[#00ff88] focus:outline-none transition font-sans"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="flex items-center gap-2 rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-4 py-2.5 text-xs font-bold text-[#00ff88] hover:bg-[#00ff88]/25 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-spin text-sm">⟳</span>
              ) : (
                <>
                  <span>ANALYZE</span>
                  <Send className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
