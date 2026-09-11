'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, Activity, Globe, RefreshCw, Zap } from 'lucide-react';
import type { Alert, DemoLocation } from '@/lib/contracts';
import { getAlerts, getDemoLocations, resetDemo } from '@/lib/api';
import SarvadarshiGlobe, { type GlobeFeature } from '@/components/SarvadarshiGlobe';

export default function CommandPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [locations, setLocations] = useState<DemoLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [globeData, setGlobeData] = useState<{ type: string; features: GlobeFeature[] } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsData, locsData] = await Promise.all([
        getAlerts().catch(() => []),
        getDemoLocations().catch(() => []),
      ]);
      setAlerts(alertsData);
      setLocations(locsData);

      // Build globe features from alerts + locations
      const features: GlobeFeature[] = alertsData.map((a: Alert) => {
        const loc = locsData.find((l: DemoLocation) =>
          a.subject?.toLowerCase().includes(l.id.replace('port-', '').replace('-', ' '))
        );
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: loc ? [loc.longitude, loc.latitude] : [0, 0],
          },
          properties: {
            title: a.subject,
            type: a.signal_type,
            intensity: a.posterior,
            confidence: a.severity / 100,
            source: a.source,
            observed_at: a.observed_at,
            alert_id: a.id,
          },
        };
      });
      setGlobeData({ type: 'FeatureCollection', features });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReset = async () => {
    await resetDemo();
    await loadData();
  };

  const handleAlertClick = (alert: Alert) => {
    setSelectedAlert(alert);
  };

  const handleGlobeClick = (feature: GlobeFeature) => {
    const alertId = feature.properties.alert_id;
    if (alertId) {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) setSelectedAlert(alert);
    }
  };

  const maxPosterior = alerts.length > 0 ? Math.max(...alerts.map(a => a.posterior)) : 0;
  const criticalCount = alerts.filter(a => a.posterior > 0.5).length;

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: 'var(--bg-void)' }}>
      {/* Globe */}
      <SarvadarshiGlobe
        data={globeData || undefined}
        onFeatureClick={handleGlobeClick}
        className="absolute inset-0 z-0"
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-50 glass-panel flex items-center justify-between px-6 py-3 mx-4 mt-4 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-[var(--gold-primary)]" />
            <span className="hud-text text-sm text-[var(--text-primary)]">SARVADARSHI</span>
          </div>
          <div className="h-4 w-px bg-[var(--border-primary)]" />
          <span className="hud-text text-[10px] text-[var(--text-muted)]">COMMAND</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="gotham-stat">
            <span className="gotham-stat__value">{alerts.length}</span>
            <span className="gotham-stat__label">ALERTS</span>
          </div>
          <div className="gotham-stat">
            <span className="gotham-stat__value" style={{ color: criticalCount > 0 ? 'var(--alert-red)' : 'var(--alert-green)' }}>
              {criticalCount}
            </span>
            <span className="gotham-stat__label">CRITICAL</span>
          </div>
          <div className="gotham-stat">
            <span className="gotham-stat__value">{(maxPosterior * 100).toFixed(0)}%</span>
            <span className="gotham-stat__label">MAX POSTERIOR</span>
          </div>

          <div className="h-4 w-px bg-[var(--border-primary)]" />

          <button onClick={handleReset} className="btn-tactical text-[10px] py-1.5 px-3" title="Reset demo data">
            <RefreshCw className="w-3 h-3 inline mr-1" />
            RESET
          </button>

          <Link href="/risk" className="btn-tactical btn-tactical--cyan text-[10px] py-1.5 px-3">
            <Activity className="w-3 h-3 inline mr-1" />
            RISK DASHBOARD
          </Link>
        </div>
      </div>

      {/* Alert sidebar */}
      <div className="absolute top-20 left-4 bottom-4 w-80 z-40 glass-panel flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--alert-orange)]" />
            <span className="hud-text text-[11px] text-[var(--text-primary)]">DISRUPTION ALERTS</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Bayesian posterior updates from live signal fusion
          </p>
        </div>

        <div className="flex-1 overflow-y-auto styled-scrollbar p-3 space-y-2">
          {loading && (
            <div className="text-center py-8 text-[var(--text-muted)] text-[11px] font-mono">
              Loading alerts...
            </div>
          )}
          {!loading && alerts.length === 0 && (
            <div className="text-center py-8 text-[var(--text-muted)] text-[11px] font-mono">
              No alerts. Click RESET to seed demo data.
            </div>
          )}
          {alerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() => handleAlertClick(alert)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedAlert?.id === alert.id
                  ? 'border-[var(--gold-primary)] bg-[rgba(var(--gold-rgb),0.08)]'
                  : 'border-[var(--border-secondary)] bg-[var(--bg-secondary)] hover:border-[var(--border-primary)]'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] leading-tight">
                  {alert.subject}
                </span>
                <span
                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{
                    color: alert.posterior > 0.5 ? 'var(--alert-red)' : alert.posterior > 0.3 ? 'var(--alert-orange)' : 'var(--alert-green)',
                    background: alert.posterior > 0.5 ? 'rgba(255,61,61,0.12)' : alert.posterior > 0.3 ? 'rgba(255,149,0,0.12)' : 'rgba(0,230,118,0.12)',
                  }}
                >
                  {(alert.posterior * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-mono text-[var(--text-muted)]">
                <span>{alert.source}</span>
                <span>|</span>
                <span>{alert.signal_type}</span>
              </div>
              <div className="mt-1.5 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${alert.posterior * 100}%`,
                    background: alert.posterior > 0.5
                      ? 'linear-gradient(90deg, var(--alert-red), #ff6b6b)'
                      : alert.posterior > 0.3
                      ? 'linear-gradient(90deg, var(--alert-orange), #ffb74d)'
                      : 'linear-gradient(90deg, var(--alert-green), #69f0ae)',
                  }}
                />
              </div>
            </button>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-[var(--border-primary)] flex items-center justify-between">
          <span className="text-[9px] font-mono text-[var(--text-muted)]">
            {locations.length} monitored locations
          </span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--alert-green)] animate-pulse" />
            <span className="text-[9px] font-mono text-[var(--text-muted)]">LIVE</span>
          </div>
        </div>
      </div>

      {/* Selected alert detail popup */}
      {selectedAlert && (
        <div className="absolute bottom-4 right-4 z-50 glass-panel p-4 w-96 max-h-64 overflow-y-auto styled-scrollbar">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-[13px] font-mono font-bold text-[var(--text-primary)]">
                {selectedAlert.subject}
              </h3>
              <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                {selectedAlert.source} &middot; {selectedAlert.signal_type}
              </p>
            </div>
            <button
              onClick={() => setSelectedAlert(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg"
            >
              &times;
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="gotham-stat">
              <span className="gotham-stat__value">{(selectedAlert.posterior * 100).toFixed(1)}%</span>
              <span className="gotham-stat__label">POSTERIOR</span>
            </div>
            <div className="gotham-stat">
              <span className="gotham-stat__value">{(selectedAlert.prior * 100).toFixed(1)}%</span>
              <span className="gotham-stat__label">PRIOR</span>
            </div>
            <div className="gotham-stat">
              <span className="gotham-stat__value">{selectedAlert.severity.toFixed(0)}</span>
              <span className="gotham-stat__label">SEVERITY</span>
            </div>
          </div>

          <div className="gotham-divider mb-2">
            <span className="gotham-divider__label">EVIDENCE LEDGER</span>
          </div>

          <div className="space-y-1">
            {selectedAlert.evidence.map((ev, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-[var(--text-secondary)]">{ev.name}</span>
                <span style={{ color: ev.contribution > 0 ? 'var(--alert-red)' : 'var(--alert-green)' }}>
                  {ev.contribution > 0 ? '+' : ''}{(ev.contribution * 100).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zulu clock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
        <ZuluClock />
      </div>
    </div>
  );
}

function ZuluClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      setTime(`ZULU ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}Z`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <span className="hud-text text-[11px] text-[var(--text-muted)] bg-[var(--bg-panel)] px-3 py-1.5 rounded-lg border border-[var(--border-secondary)]">
      {time}
    </span>
  );
}
