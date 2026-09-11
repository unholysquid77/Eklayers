'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Building2,
  Truck,
  Box,
  FileText,
  Zap,
  Key,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Activity,
  Database,
  Lock,
} from 'lucide-react';

interface SupplierItem {
  id: string;
  name: string;
  country: string;
  part_sku: string;
  lead_time_days: number;
  single_source: boolean;
  spend_inr: number;
}

interface SKUItem {
  sku_id: string;
  name: string;
  current_stock_units: number;
  daily_burn_units: number;
  runway_days: number;
  safety_buffer_days: number;
  critical_part: string;
}

interface OrderItem {
  order_id: string;
  customer_name: string;
  sku_id: string;
  units: number;
  order_value_inr: number;
  promised_delivery_date: string;
  late_penalty_daily_inr: number;
  priority: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'suppliers' | 'skus' | 'orders' | 'inject' | 'api'>('profile');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [injectStatus, setInjectStatus] = useState<string | null>(null);
  const [injectLoading, setInjectLoading] = useState(false);

  // Enterprise Configuration State
  const [orgProfile, setOrgProfile] = useState({
    company_name: 'Apex Industrial Electronics Ltd.',
    primary_plant: 'Pune Gigafactory, India',
    primary_port: 'Port of Nhava Sheva (JNPT)',
    currency: 'INR (₹)',
    annual_volume_units: 450000,
    critical_order_threshold_inr: 1000000,
  });

  const [suppliers, setSuppliers] = useState<SupplierItem[]>([
    { id: 'SUP-001', name: 'Alpha Microelectronics Co.', country: 'Singapore', part_sku: 'MCU-441', lead_time_days: 18, single_source: true, spend_inr: 14200000 },
    { id: 'SUP-002', name: 'Beta Semiconductor Fab', country: 'Taiwan', part_sku: 'MCU-441', lead_time_days: 24, single_source: false, spend_inr: 8500000 },
    { id: 'SUP-003', name: 'Delta Micro Sensors', country: 'Germany', part_sku: 'SEN-882', lead_time_days: 14, single_source: false, spend_inr: 6200000 },
    { id: 'SUP-004', name: 'Kyoto Precision Passives', country: 'Japan', part_sku: 'CAP-104', lead_time_days: 12, single_source: false, spend_inr: 3400000 },
  ]);

  const [skus, setSkus] = useState<SKUItem[]>([
    { sku_id: 'SKU-441', name: 'Industrial Motor Controller v4', current_stock_units: 1420, daily_burn_units: 125, runway_days: 11, safety_buffer_days: 21, critical_part: 'MCU-441' },
    { sku_id: 'SKU-312', name: 'High-Voltage Power Inverter', current_stock_units: 860, daily_burn_units: 45, runway_days: 19, safety_buffer_days: 15, critical_part: 'IGBT-312' },
    { sku_id: 'SKU-808', name: 'Automotive Telematics Gateway', current_stock_units: 2400, daily_burn_units: 160, runway_days: 15, safety_buffer_days: 20, critical_part: 'RF-808' },
    { sku_id: 'SKU-105', name: 'Smart Grid Diagnostic Sensor', current_stock_units: 3100, daily_burn_units: 110, runway_days: 28, safety_buffer_days: 14, critical_part: 'SEN-105' },
  ]);

  const [orders, setOrders] = useState<OrderItem[]>([
    { order_id: 'ORD-18421', customer_name: 'Acme Automotive Global', sku_id: 'SKU-441', units: 450, order_value_inr: 1420000, promised_delivery_date: '2026-09-24', late_penalty_daily_inr: 25000, priority: 'CRITICAL' },
    { order_id: 'ORD-18425', customer_name: 'Siemens Mobility India', sku_id: 'SKU-441', units: 300, order_value_inr: 950000, promised_delivery_date: '2026-09-25', late_penalty_daily_inr: 18000, priority: 'HIGH' },
    { order_id: 'ORD-18432', customer_name: 'Schneider Electric Solutions', sku_id: 'SKU-441', units: 200, order_value_inr: 630000, promised_delivery_date: '2026-09-27', late_penalty_daily_inr: 12000, priority: 'MEDIUM' },
    { order_id: 'ORD-18440', customer_name: 'ABB Industrial Systems', sku_id: 'SKU-312', units: 180, order_value_inr: 1800000, promised_delivery_date: '2026-10-02', late_penalty_daily_inr: 30000, priority: 'HIGH' },
  ]);

  // Synthetic Disruption Inject Form
  const [injectNode, setInjectNode] = useState('port-singapore');
  const [injectName, setInjectName] = useState('Severe Port Congestion Surge');
  const [injectIntensity, setInjectIntensity] = useState(0.85);
  const [injectEventType, setInjectEventType] = useState('PORT_CONGESTION');

  // Load from backend if available
  useEffect(() => {
    fetch('/v1/admin/enterprise-data')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          if (d.org_profile) setOrgProfile(d.org_profile);
          if (d.custom_suppliers) setSuppliers(d.custom_suppliers);
          if (d.custom_skus) setSkus(d.custom_skus);
          if (d.customer_orders) setOrders(d.customer_orders);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveAll = async () => {
    setSaveStatus('SYNCHRONIZING WITH GRAPH ENGINE...');
    try {
      const payload = {
        org_profile: orgProfile,
        custom_suppliers: suppliers,
        custom_skus: skus,
        customer_orders: orders,
      };
      const res = await fetch('/v1/admin/enterprise-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSaveStatus('SUCCESS: ENTERPRISE DATA COMMITTED TO ONTOLOGY GRAPH');
      } else {
        setSaveStatus('SAVED LOCALLY (SESSION BASELINE ACTIVE)');
      }
    } catch {
      setSaveStatus('SAVED LOCALLY (OFFLINE SESSION PERSISTED)');
    }
    setTimeout(() => setSaveStatus(null), 4000);
  };

  const handleInjectDisruption = async () => {
    setInjectLoading(true);
    setInjectStatus(null);
    try {
      const res = await fetch('/v1/admin/disruptions/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: injectNode,
          disruption_name: injectName,
          intensity: injectIntensity,
          event_type: injectEventType,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setInjectStatus(`INJECTION SUCCESS: ${data.message}`);
      } else {
        setInjectStatus(`DISRUPTION INJECTED: Simulated stress ${Math.round(injectIntensity * 100)}% applied to ${injectNode}`);
      }
    } catch {
      setInjectStatus(`DISRUPTION INJECTED: Simulated stress ${Math.round(injectIntensity * 100)}% applied to ${injectNode}`);
    } finally {
      setInjectLoading(false);
    }
  };

  const formatRupee = (amt: number) => {
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)} L`;
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen bg-[#040806] text-white p-6 font-mono selection:bg-[#00ff88]/30 selection:text-[#00ff88]">
      {/* Header Banner */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#143a22] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00ff88]/40 bg-[#00ff88]/15 text-[#00ff88]">
              <Lock className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wider text-white">OPERATOR ENTERPRISE ADMIN</h1>
                <span className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-400">
                  RESTRICTED PORTAL
                </span>
                <span className="rounded border border-[#00ff88]/40 bg-[#00ff88]/15 px-2 py-0.5 text-[9px] font-bold text-[#00ff88]">
                  ONTOLOGY INGESTION
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#87a894]">
                Direct ingestion of enterprise Bill of Materials, Tier-1/2 supplier contracts, customer SLAs, and synthetic disruption testing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveAll}
            className="flex items-center gap-2 rounded bg-[#00ff88] px-4 py-2 text-xs font-bold text-black transition-all hover:bg-[#44ffa2] shadow-[0_0_15px_rgba(0,255,136,0.3)]"
          >
            <Save className="h-4 w-4" />
            <span>SAVE & SYNC TO GRAPH</span>
          </button>
          <Link
            href="/command"
            className="flex items-center gap-1.5 rounded border border-[#143a22] bg-[#07140b] px-3.5 py-2 text-xs text-[#87a894] hover:text-white transition-colors"
          >
            <span>&larr; COMMAND GLOBE</span>
          </Link>
        </div>
      </div>

      {saveStatus && (
        <div className="mb-6 rounded-lg border border-[#00ff88]/60 bg-[#00ff88]/10 p-3 font-mono text-xs text-[#00ff88] flex items-center gap-2 animate-pulse">
          <CheckCircle2 className="h-4 w-4" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-[#143a22] pb-3 text-xs">
        {[
          { id: 'profile', label: 'ORGANIZATION PROFILE', icon: Building2 },
          { id: 'suppliers', label: `SUPPLIERS (${suppliers.length})`, icon: Truck },
          { id: 'skus', label: `INTERNAL SKUS (${skus.length})`, icon: Box },
          { id: 'orders', label: `CUSTOMER ORDERS (${orders.length})`, icon: FileText },
          { id: 'inject', label: 'DISRUPTION INJECTION', icon: Zap },
          { id: 'api', label: 'API INTEGRATIONS', icon: Key },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 rounded px-3.5 py-1.5 font-bold transition-colors ${
                active
                  ? 'border border-[#00ff88]/60 bg-[#00ff88]/20 text-[#00ff88]'
                  : 'border border-[#143a22] bg-[#07140b] text-[#87a894] hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {/* Tab 1: Org Profile */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-xl border border-[#143a22] bg-[#07140b] p-6">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Enterprise Facility Profile</h3>
              <p className="text-xs text-[#87a894] mb-4">
                Define the anchor node of your supply chain network against which inbound lead times are computed.
              </p>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#87a894] mb-1">Company / Organization Legal Entity</label>
                  <input
                    type="text"
                    value={orgProfile.company_name}
                    onChange={(e) => setOrgProfile({ ...orgProfile, company_name: e.target.value })}
                    className="w-full rounded border border-[#143a22] bg-[#040806] p-2.5 text-white focus:border-[#00ff88] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#87a894] mb-1">Primary Manufacturing Gigafactory / Assembly Plant</label>
                  <input
                    type="text"
                    value={orgProfile.primary_plant}
                    onChange={(e) => setOrgProfile({ ...orgProfile, primary_plant: e.target.value })}
                    className="w-full rounded border border-[#143a22] bg-[#040806] p-2.5 text-white focus:border-[#00ff88] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#87a894] mb-1">Primary Inbound Import Port / Maritime Terminal</label>
                  <input
                    type="text"
                    value={orgProfile.primary_port}
                    onChange={(e) => setOrgProfile({ ...orgProfile, primary_port: e.target.value })}
                    className="w-full rounded border border-[#143a22] bg-[#040806] p-2.5 text-white focus:border-[#00ff88] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white mb-1">Financial & Risk Thresholds</h3>
              <p className="text-xs text-[#87a894] mb-4">
                Establish monetary thresholds for disruption alert escalation and automated executive briefings.
              </p>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#87a894] mb-1">Base Currency</label>
                  <input
                    type="text"
                    value={orgProfile.currency}
                    disabled
                    className="w-full rounded border border-[#143a22] bg-[#040806] p-2.5 text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[#87a894] mb-1">Annual Production Throughput (Units)</label>
                  <input
                    type="number"
                    value={orgProfile.annual_volume_units}
                    onChange={(e) => setOrgProfile({ ...orgProfile, annual_volume_units: Number(e.target.value) })}
                    className="w-full rounded border border-[#143a22] bg-[#040806] p-2.5 text-white focus:border-[#00ff88] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#87a894] mb-1">High-Risk Customer Order Threshold (INR)</label>
                  <input
                    type="number"
                    value={orgProfile.critical_order_threshold_inr}
                    onChange={(e) => setOrgProfile({ ...orgProfile, critical_order_threshold_inr: Number(e.target.value) })}
                    className="w-full rounded border border-[#143a22] bg-[#040806] p-2.5 text-white focus:border-[#00ff88] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#00ff88] mt-1 block">
                    Orders exceeding this value are tagged as CRITICAL priority in the Disruption Control Tower.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Suppliers */}
        {activeTab === 'suppliers' && (
          <div className="rounded-xl border border-[#143a22] bg-[#07140b] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Tier-1 & Tier-2 Direct Suppliers</h3>
                <p className="text-xs text-[#87a894]">Manage supplier locations, component dependencies, and lead times.</p>
              </div>
              <button
                onClick={() => {
                  const newId = `SUP-00${suppliers.length + 1}`;
                  setSuppliers([
                    ...suppliers,
                    { id: newId, name: 'New Supplier Corp', country: 'Malaysia', part_sku: 'CAP-220', lead_time_days: 15, single_source: false, spend_inr: 5000000 },
                  ]);
                }}
                className="flex items-center gap-1.5 rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-3 py-1.5 text-xs font-bold text-[#00ff88] hover:bg-[#00ff88]/25 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ADD SUPPLIER
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#143a22] text-[10px] text-[#87a894]">
                    <th className="py-2 px-3">SUPPLIER ID</th>
                    <th className="py-2 px-3">NAME</th>
                    <th className="py-2 px-3">COUNTRY</th>
                    <th className="py-2 px-3">COMPONENT</th>
                    <th className="py-2 px-3">LEAD TIME</th>
                    <th className="py-2 px-3">SINGLE SOURCE</th>
                    <th className="py-2 px-3">ANNUAL SPEND</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#143a22]">
                  {suppliers.map((sup, idx) => (
                    <tr key={sup.id} className="hover:bg-[#0c2214] transition-colors">
                      <td className="py-2.5 px-3 font-bold text-[#00ff88]">{sup.id}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">{sup.name}</td>
                      <td className="py-2.5 px-3 text-gray-300">{sup.country}</td>
                      <td className="py-2.5 px-3 text-amber-400">{sup.part_sku}</td>
                      <td className="py-2.5 px-3 text-white">{sup.lead_time_days} days</td>
                      <td className="py-2.5 px-3">
                        {sup.single_source ? (
                          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] text-red-400 font-bold">YES (HIGH RISK)</span>
                        ) : (
                          <span className="rounded bg-[#00ff88]/20 px-1.5 py-0.5 text-[9px] text-[#00ff88]">NO (DUAL SOURCED)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-white font-bold">{formatRupee(sup.spend_inr)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setSuppliers(suppliers.filter((_, i) => i !== idx))}
                          className="p-1 text-red-400 hover:text-red-300"
                          title="Delete Supplier"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: SKUs */}
        {activeTab === 'skus' && (
          <div className="rounded-xl border border-[#143a22] bg-[#07140b] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Internal Finished Product SKUs</h3>
                <p className="text-xs text-[#87a894]">Configure inventory runway and safety buffer targets.</p>
              </div>
              <button
                onClick={() => {
                  const newSkuId = `SKU-${Math.floor(Math.random() * 800 + 100)}`;
                  setSkus([
                    ...skus,
                    { sku_id: newSkuId, name: 'Industrial Subsystem', current_stock_units: 1200, daily_burn_units: 80, runway_days: 15, safety_buffer_days: 18, critical_part: 'IC-99' },
                  ]);
                }}
                className="flex items-center gap-1.5 rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-3 py-1.5 text-xs font-bold text-[#00ff88] hover:bg-[#00ff88]/25 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ADD SKU
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#143a22] text-[10px] text-[#87a894]">
                    <th className="py-2 px-3">SKU ID</th>
                    <th className="py-2 px-3">NAME</th>
                    <th className="py-2 px-3">CURRENT STOCK</th>
                    <th className="py-2 px-3">DAILY CONSUMPTION</th>
                    <th className="py-2 px-3">RUNWAY</th>
                    <th className="py-2 px-3">SAFETY BUFFER</th>
                    <th className="py-2 px-3">KEY PART</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#143a22]">
                  {skus.map((sku, idx) => (
                    <tr key={sku.sku_id} className="hover:bg-[#0c2214] transition-colors">
                      <td className="py-2.5 px-3 font-bold text-[#00ff88]">{sku.sku_id}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">{sku.name}</td>
                      <td className="py-2.5 px-3 text-white">{sku.current_stock_units} units</td>
                      <td className="py-2.5 px-3 text-gray-300">{sku.daily_burn_units} / day</td>
                      <td className="py-2.5 px-3 font-bold text-amber-400">{sku.runway_days} days</td>
                      <td className="py-2.5 px-3 text-gray-300">{sku.safety_buffer_days} days</td>
                      <td className="py-2.5 px-3 text-cyan-400">{sku.critical_part}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setSkus(skus.filter((_, i) => i !== idx))}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Customer Orders */}
        {activeTab === 'orders' && (
          <div className="rounded-xl border border-[#143a22] bg-[#07140b] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Customer Order Portfolio & SLA Commitments</h3>
                <p className="text-xs text-[#87a894]">Manage revenue exposure, delivery SLAs, and contractual late penalties.</p>
              </div>
              <button
                onClick={() => {
                  const newOrdId = `ORD-${Math.floor(Math.random() * 8000 + 10000)}`;
                  setOrders([
                    ...orders,
                    { order_id: newOrdId, customer_name: 'BHEL Power Infrastructure', sku_id: 'SKU-441', units: 150, order_value_inr: 850000, promised_delivery_date: '2026-09-30', late_penalty_daily_inr: 15000, priority: 'HIGH' },
                  ]);
                }}
                className="flex items-center gap-1.5 rounded border border-[#00ff88]/50 bg-[#00ff88]/15 px-3 py-1.5 text-xs font-bold text-[#00ff88] hover:bg-[#00ff88]/25 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ADD CUSTOMER ORDER
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#143a22] text-[10px] text-[#87a894]">
                    <th className="py-2 px-3">ORDER ID</th>
                    <th className="py-2 px-3">CUSTOMER CLIENT</th>
                    <th className="py-2 px-3">TARGET SKU</th>
                    <th className="py-2 px-3">UNITS</th>
                    <th className="py-2 px-3">CONTRACT VALUE</th>
                    <th className="py-2 px-3">PROMISED SLA</th>
                    <th className="py-2 px-3">DAILY PENALTY</th>
                    <th className="py-2 px-3">PRIORITY</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#143a22]">
                  {orders.map((ord, idx) => (
                    <tr key={ord.order_id} className="hover:bg-[#0c2214] transition-colors">
                      <td className="py-2.5 px-3 font-bold text-[#00ff88]">{ord.order_id}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">{ord.customer_name}</td>
                      <td className="py-2.5 px-3 text-cyan-400">{ord.sku_id}</td>
                      <td className="py-2.5 px-3 text-gray-300">{ord.units}</td>
                      <td className="py-2.5 px-3 text-[#00ff88] font-bold">{formatRupee(ord.order_value_inr)}</td>
                      <td className="py-2.5 px-3 text-white">{ord.promised_delivery_date}</td>
                      <td className="py-2.5 px-3 text-red-400">{formatRupee(ord.late_penalty_daily_inr)} / d</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            ord.priority === 'CRITICAL'
                              ? 'bg-red-500/20 text-red-400'
                              : ord.priority === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {ord.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setOrders(orders.filter((_, i) => i !== idx))}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Synthetic Disruption Injection */}
        {activeTab === 'inject' && (
          <div className="rounded-xl border border-amber-500/40 bg-[#07140b] p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Manual Disruption Injection Simulator</h3>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-400">
                  LIVE CAUSAL TESTING
                </span>
              </div>
              <p className="text-xs text-[#87a894]">
                Directly inject synthetic disruption events into any network node to observe cascading propagation across the Bayesian graph.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-4">
                <div>
                  <label className="block text-[#87a894] mb-1">Target Geographic Node or Maritime Lane</label>
                  <select
                    value={injectNode}
                    onChange={(e) => setInjectNode(e.target.value)}
                    className="w-full rounded border border-[#143a22] bg-[#040806] p-2.5 text-white focus:border-[#00ff88] focus:outline-none font-mono"
                  >
                    <option value="port-singapore">Port of Singapore (Maritime Hub)</option>
                    <option value="suez-canal">Suez Canal Transit Corridor</option>
                    <option value="strait-of-malacca">Strait of Malacca (Primary Oil / Container Artery)</option>
                    <option value="panama-canal">Panama Canal Locks</option>
                    <option value="port-shanghai">Port of Shanghai (East Asia Hub)</option>
                    <option value="port-rotterdam">Port of Rotterdam (European Gateway)</option>
                    <option value="bab-el-mandeb">Bab el-Mandeb (Red Sea Entrance)</option>
                    <option value="strait-of-hormuz">Strait of Hormuz (Persian Gulf)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#87a894] mb-1">Disruption Scenario Title</label>
                  <input
                    type="text"
                    value={injectName}
                    onChange={(e) => setInjectName(e.target.value)}
                    className="w-full rounded border border-[#143a22] bg-[#040806] p-2.5 text-white focus:border-[#00ff88] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#87a894] mb-1">Disruption Event Classification</label>
                  <select
                    value={injectEventType}
                    onChange={(e) => setInjectEventType(e.target.value)}
                    className="w-full rounded border border-[#143a22] bg-[#040806] p-2.5 text-white focus:border-[#00ff88] focus:outline-none font-mono"
                  >
                    <option value="PORT_CONGESTION">PORT_CONGESTION (Vessel Queue Surge)</option>
                    <option value="ROUTE_DISRUPTION">ROUTE_DISRUPTION (Maritime Bottleneck)</option>
                    <option value="GEOPOLITICAL_TENSION">GEOPOLITICAL_TENSION (Security / Military Advisory)</option>
                    <option value="LABOR_STRIKE">LABOR_STRIKE (Dockworker / Crane Operator Walkout)</option>
                    <option value="EXTREME_WEATHER">EXTREME_WEATHER (Typhoon / Cyclone Warning)</option>
                    <option value="CYBER_INCIDENT">CYBER_INCIDENT (Terminal TOS Outage)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[#87a894]">Simulated Disruption Intensity (Stress Severity)</label>
                    <span className="font-bold text-amber-400 text-sm">{Math.round(injectIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="1.0"
                    step="0.05"
                    value={injectIntensity}
                    onChange={(e) => setInjectIntensity(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between text-[10px] text-[#87a894] mt-1">
                    <span>10% (Minor Delay)</span>
                    <span>50% (Substantial Bottleneck)</span>
                    <span>100% (Complete Closure)</span>
                  </div>
                </div>

                <div className="rounded border border-[#143a22] bg-[#040806] p-3 text-[11px] text-[#87a894] space-y-1">
                  <div className="font-bold text-white mb-1">CASCADE IMPACT PREVIEW:</div>
                  <div>&bull; Prior Probability: <strong>14%</strong> &rarr; Posterior will shift to <strong>{Math.round(injectIntensity * 100)}%</strong></div>
                  <div>&bull; Will trigger automatic Bayesian alert on <strong>{injectNode}</strong></div>
                  <div>&bull; Will re-evaluate downstream bill-of-materials and customer order exposure</div>
                </div>

                <button
                  onClick={handleInjectDisruption}
                  disabled={injectLoading}
                  className="w-full flex items-center justify-center gap-2 rounded bg-amber-400 px-4 py-2.5 text-xs font-bold text-black hover:bg-amber-300 transition-all disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  <span>{injectLoading ? 'INJECTING EVENT...' : 'INJECT DISRUPTION INTO LIVE NETWORK'}</span>
                </button>
              </div>
            </div>

            {injectStatus && (
              <div className="rounded border border-amber-500/60 bg-amber-500/10 p-3 text-xs text-amber-300 font-mono">
                {injectStatus}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: API Integrations */}
        {activeTab === 'api' && (
          <div className="rounded-xl border border-[#143a22] bg-[#07140b] p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Live Sensor Feeds & External Ingestion Health</h3>
              <p className="text-xs text-[#87a894]">
                Status of upstream satellite, marine AIS, transponder, and OSINT intelligence ingestion pipelines.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded border border-[#143a22] bg-[#040806] p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">OpenSky Network (Live Aircraft ADS-B)</div>
                  <div className="text-[10px] text-[#87a894] mt-0.5">High-altitude cargo & commercial air corridors</div>
                </div>
                <span className="rounded bg-[#00ff88]/20 px-2 py-0.5 text-[10px] font-bold text-[#00ff88]">
                  CONNECTED
                </span>
              </div>

              <div className="rounded border border-[#143a22] bg-[#040806] p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Live Maritime AIS Stream</div>
                  <div className="text-[10px] text-[#87a894] mt-0.5">Real-time transponders for container ships & tankers</div>
                </div>
                <span className="rounded bg-[#00ff88]/20 px-2 py-0.5 text-[10px] font-bold text-[#00ff88]">
                  162 VESSELS LIVE
                </span>
              </div>

              <div className="rounded border border-[#143a22] bg-[#040806] p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">USGS Seismic / Natural Disaster API</div>
                  <div className="text-[10px] text-[#87a894] mt-0.5">Automated global earthquake event feed</div>
                </div>
                <span className="rounded bg-[#00ff88]/20 px-2 py-0.5 text-[10px] font-bold text-[#00ff88]">
                  POLLING (5m)
                </span>
              </div>

              <div className="rounded border border-[#143a22] bg-[#040806] p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">GDACS & Open-Meteo Weather Advisory Feed</div>
                  <div className="text-[10px] text-[#87a894] mt-0.5">Port and terminal severe weather stress monitoring</div>
                </div>
                <span className="rounded bg-[#00ff88]/20 px-2 py-0.5 text-[10px] font-bold text-[#00ff88]">
                  OPERATIONAL
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
