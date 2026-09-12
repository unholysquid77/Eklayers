'use client';

import { useState } from 'react';
import {
  Crosshair,
  Zap,
  CheckCircle2,
  X,
  AlertTriangle,
  Send,
  Terminal,
  ShieldAlert,
  ArrowRight,
  Clock,
  DollarSign,
  Radio,
} from 'lucide-react';

export interface KillChainAction {
  title: string;
  category?: string;
  targetEntity: string;
  physicalEffect: string;
  telemetryHook: string;
  budgetCommitment?: string;
  leadTimeDelta?: string;
  riskMitigation?: string;
}

interface KillChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: KillChainAction | null;
}

export function KillChainButton({
  label = 'EXECUTE DISPATCH',
  action,
  onTrigger,
  className = '',
}: {
  label?: string;
  action: KillChainAction;
  onTrigger: (act: KillChainAction) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onTrigger(action);
      }}
      className={`border border-[#3d4d42] bg-[#1a221d] hover:bg-[#253029] hover:border-[#00e676]/60 text-[#f0f4f1] hover:text-[#00e676] px-2.5 py-1 text-[10px] font-mono tracking-wider uppercase font-bold flex items-center gap-1.5 transition active:scale-95 shadow-[0_1px_4px_rgba(0,0,0,0.6)] cursor-pointer ${className}`}
      title="Live physical execution hook (Palantir Gotham kill-chain simulation)"
    >
      <Crosshair className="w-3 h-3 text-[#00e676] shrink-0 animate-pulse" />
      <span>{label}</span>
    </button>
  );
}

export default function KillChainModal({
  isOpen,
  onClose,
  action,
}: KillChainModalProps) {
  const [dispatchStatus, setDispatchStatus] = useState<'idle' | 'dispatching' | 'confirmed'>('idle');
  const [auditLog, setAuditLog] = useState<string[]>([]);

  if (!isOpen || !action) return null;

  const handleSimulateDispatch = () => {
    setDispatchStatus('dispatching');
    setAuditLog([
      `[T-0.00s] Initializing encrypted AS2 / EDI protocol handshake to ${action.telemetryHook.split('/')[0].trim()}...`,
    ]);

    setTimeout(() => {
      setAuditLog((prev) => [
        ...prev,
        `[T+0.45s] Packaging payload: Target [${action.targetEntity}] -> Physical Hook verified.`,
        `[T+0.90s] Transmitting authenticated operational directive via secure webhook...`,
      ]);
    }, 450);

    setTimeout(() => {
      setAuditLog((prev) => [
        ...prev,
        `[T+1.40s] External carrier/ERP gateway response: ACK 200 OK. Directive accepted.`,
        `[T+1.80s] Transaction ledger committed: TX-ID #${Math.floor(100000 + Math.random() * 900000)} (Immutable Audit Trail).`,
      ]);
      setDispatchStatus('confirmed');
    }, 1200);
  };

  const handleClose = () => {
    setDispatchStatus('idle');
    setAuditLog([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm font-mono">
      <div className="relative w-full max-w-2xl border border-[#00e676]/60 bg-[#030704] text-white shadow-[0_0_50px_rgba(0,255,136,0.15)] flex flex-col max-h-[90vh]">
        {/* Top Military HUD Header */}
        <div className="flex items-center justify-between border-b border-[#112818] bg-[#050c07] px-4 py-3">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-[#00e676] animate-spin" style={{ animationDuration: '10s' }} />
            <span className="border border-[#00e676]/40 bg-[#00e676]/10 px-2 py-0.5 text-[9px] font-black tracking-widest text-[#00e676]">
              [LIVE DEPLOYMENT PROTOCOL — PHYSICAL EXECUTION HOOK]
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-[#4e6e58] hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {/* Action Title & Category */}
          <div className="border-b border-[#112818] pb-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#4e6e58] tracking-widest uppercase">
                TACTICAL MISSION KILL-CHAIN ACTION
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-amber-400">
                <Radio className="w-3 h-3 animate-ping" />
                <span>STATE: SIMULATION SANDBOX // ARMED</span>
              </span>
            </div>
            <h2 className="text-lg font-black text-white mt-1 flex items-center gap-2">
              <span>{action.title}</span>
            </h2>
          </div>

          {/* Gotham Live Production Notice Banner */}
          <div className="border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-200/90 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-400 uppercase tracking-wider block font-bold text-[11px]">
                DURING LIVE DEPLOYMENT, THIS BUTTON WILL:
              </strong>
              <p className="mt-1 text-[#e0e8e3] font-sans text-xs">
                {action.physicalEffect}
              </p>
            </div>
          </div>

          {/* Execution Telemetry Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="border border-[#112818] bg-[#020503] p-3 space-y-1">
              <span className="text-[10px] text-[#4e6e58] uppercase font-bold tracking-wider">TARGET ENTITY</span>
              <p className="text-white font-bold text-xs truncate">{action.targetEntity}</p>
            </div>

            <div className="border border-[#112818] bg-[#020503] p-3 space-y-1">
              <span className="text-[10px] text-[#4e6e58] uppercase font-bold tracking-wider">PHYSICAL DISPATCH PROTOCOL</span>
              <p className="text-[#00e676] font-bold text-xs truncate">{action.telemetryHook}</p>
            </div>

            {action.budgetCommitment && (
              <div className="border border-[#112818] bg-[#020503] p-3 space-y-1">
                <span className="text-[10px] text-[#4e6e58] uppercase font-bold tracking-wider">BUDGET AUTHORIZATION</span>
                <p className="text-amber-300 font-bold text-xs">{action.budgetCommitment}</p>
              </div>
            )}

            {action.leadTimeDelta && (
              <div className="border border-[#112818] bg-[#020503] p-3 space-y-1">
                <span className="text-[10px] text-[#4e6e58] uppercase font-bold tracking-wider">IMPACT ON LEAD TIME</span>
                <p className="text-[#00e676] font-bold text-xs">{action.leadTimeDelta}</p>
              </div>
            )}
          </div>

          {action.riskMitigation && (
            <div className="border border-[#112818] bg-[#020503] p-3 text-xs space-y-1">
              <span className="text-[10px] text-[#4e6e58] uppercase font-bold tracking-wider">OPERATIONAL RECOVERY PROFILE</span>
              <p className="text-[#87a894] font-sans text-xs">{action.riskMitigation}</p>
            </div>
          )}

          {/* Audit Terminal Log (Simulated execution) */}
          {auditLog.length > 0 && (
            <div className="border border-[#00e676]/40 bg-black p-3 space-y-1 text-[11px] font-mono">
              <div className="text-[#4e6e58] flex items-center gap-1 text-[9px] uppercase border-b border-[#112818] pb-1">
                <Terminal className="w-3 h-3 text-[#00e676]" />
                <span>SECURE DISPATCH TELEMETRY AUDIT TRAIL</span>
              </div>
              <div className="space-y-0.5 pt-1 text-[#00e676]">
                {auditLog.map((log, idx) => (
                  <div key={idx} className="truncate">{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#112818] bg-[#050c07] px-4 py-3 flex items-center justify-between">
          <span className="text-[10px] text-[#4e6e58] tracking-widest hidden sm:inline">
            DISPATCH KEY: [ACTIVE]
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleClose}
              className="border border-[#112818] bg-[#000000] px-3 py-1.5 text-xs text-[#87a894] hover:text-white transition"
            >
              DISARM / ABORT
            </button>

            {dispatchStatus === 'confirmed' ? (
              <div className="flex items-center gap-1.5 border border-[#00e676] bg-[#00e676]/20 px-3 py-1.5 text-xs font-bold text-[#00e676]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>DISPATCH LOGGED TO IMMUTABLE AUDIT</span>
              </div>
            ) : (
              <button
                disabled={dispatchStatus === 'dispatching'}
                onClick={handleSimulateDispatch}
                className="border border-[#00e676] bg-[#00e676]/25 hover:bg-[#00e676]/40 text-[#00e676] px-4 py-1.5 text-xs font-bold transition flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,255,136,0.2)] active:translate-y-px disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{dispatchStatus === 'dispatching' ? 'TRANSMITTING DIRECTIVE...' : 'CONFIRM SIMULATED DISPATCH'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
