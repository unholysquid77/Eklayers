'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Globe2,
  Layers,
  Search,
  Activity,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  TrendingUp,
  Cpu,
  Truck,
  Database,
  Terminal,
  BarChart3,
  Box,
} from 'lucide-react';
import { resetDemoState } from '@/lib/api';

const NAV_ITEMS = [
  { label: 'GLOBE', href: '/command', icon: Globe2 },
  { label: 'AI ANALYST', href: '/analyst', icon: Sparkles },
  { label: 'CONTROL TOWER', href: '/control-tower', icon: Activity },
  { label: 'CONSOLE', href: '/console', icon: Terminal },
  { label: 'EXPOSURE', href: '/exposure', icon: Box },
  { label: 'FORECAST', href: '/forecast', icon: TrendingUp },
  { label: 'SUPPLIERS', href: '/suppliers', icon: Truck },
  { label: 'SCENARIOS', href: '/scenarios', icon: Layers },
];

export default function TopNav() {
  const pathname = usePathname();
  const [resetting, setResetting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      await resetDemoState();
      setToastMsg('DEMO REINITIALISED TO CANONICAL SINGAPORE BASELINE');
      setTimeout(() => setToastMsg(null), 4000);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sarvadarshi:demo_reset'));
      }
    } catch {
      setToastMsg('DEMO RESET TRIGGERED (LOCAL BASELINE RESTORED)');
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#112818] bg-black/95 border-b border-[#112818]">
      <div className="flex h-12 w-full items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/control-tower" className="flex items-center gap-2 group">
            <span className="h-2.5 w-2.5 rounded-full bg-[#00e676] animate-pulse " />
            <span className="font-mono text-sm font-black tracking-wider text-white group-hover:text-[#00e676] transition">
              SARVADARSHI
            </span>
          </Link>
          <span className="hidden lg:inline-block font-mono text-[10px] text-[#4e6e58] border-l border-[#112818] pl-3">
            CONTINUOUS SUPPLY CHAIN INTELLIGENCE
          </span>
        </div>

        {/* Center Nav Links */}
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === '/control-tower' && pathname === '/');
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/50 '
                    : 'text-[#87a894] hover:text-[#d1fae5] hover:bg-[#00e676]/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00e676]' : 'text-[#4e6e58]'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Utilities */}
        <div className="flex items-center gap-3">
          {/* Demo badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#112818] bg-[#020503] font-mono text-[10px] text-[#4e6e58]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span>SIMULATED ENTERPRISE</span>
          </div>

          {/* Reset Demo Button */}
          <button
            onClick={handleResetDemo}
            disabled={resetting}
            title="Reset to canonical Singapore disruption demo baseline"
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#112818] hover:border-[#00e676]/60 bg-[#020503] hover:bg-[#00e676]/15 font-mono text-xs text-[#87a894] hover:text-[#00e676] transition"
          >
            <RotateCcw className={`w-3 h-3 ${resetting ? 'animate-spin text-[#00e676]' : ''}`} />
            <span className="hidden md:inline">RESET DEMO</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMsg && (
        <div className="bg-[#00e676]/15 border-t border-b border-[#00e676]/40 px-4 py-1 text-center font-mono text-xs text-[#00e676] animate-in fade-in slide-in-from-top-1">
          {toastMsg}
        </div>
      )}
    </header>
  );
}
