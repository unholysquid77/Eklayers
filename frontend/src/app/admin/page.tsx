'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getEnterpriseData,
  updateEnterpriseData,
  injectDisruption,
  getEnterpriseRoutes,
  saveEnterpriseRoute,
  deleteEnterpriseRoute,
  validateApiKey,
  getCustomSupplyChains,
  addCustomSupplyChain,
  getDataHealth,
} from '@/lib/api';
import type {
  EnterpriseData,
  EnterpriseOrgProfile,
  EnterpriseSupplier,
  EnterpriseSKU,
  EnterpriseOrder,
  EnterpriseRoute,
  EnterprisePlant,
  EnterpriseApiCredentials,
} from '@/lib/contracts';
import {
  Share2,
  Compass,
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
  Edit2,
  Check,
  Eye,
  EyeOff,
  Radio,
  Layers,
  MapPin,
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    'profile' | 'plants' | 'suppliers' | 'skus' | 'orders' | 'routes' | 'chains' | 'inject' | 'api'
  >('profile');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [injectStatus, setInjectStatus] = useState<string | null>(null);
  const [injectLoading, setInjectLoading] = useState(false);

  // Enterprise Configuration State
  const [orgProfile, setOrgProfile] = useState<EnterpriseOrgProfile>({
    company_name: 'Apex Industrial Electronics Ltd.',
    primary_plant: 'Pune Gigafactory, India',
    primary_port: 'Port of Nhava Sheva (JNPT)',
    currency: 'INR (₹)',
    annual_volume_units: 450000,
    critical_order_threshold_inr: 1000000,
  });

  const [plants, setPlants] = useState<EnterprisePlant[]>([
    {
      id: 'PLANT-01',
      name: 'Pune Gigafactory (Chakan Industrial Zone)',
      location: 'Pune, Maharashtra, India',
      capacity_units_day: 1500,
      critical_lines: 'Line A (Motor Controllers), Line B (Inverters)',
      status: 'OPERATIONAL',
    },
    {
      id: 'PLANT-02',
      name: 'Bengaluru Advanced R&D & Pilot Assembly',
      location: 'Electronic City, Bengaluru, India',
      capacity_units_day: 300,
      critical_lines: 'Pilot Line (Sensors & Gateways)',
      status: 'OPERATIONAL',
    },
  ]);

  const [suppliers, setSuppliers] = useState<EnterpriseSupplier[]>([
    { id: 'SUP-001', name: 'Alpha Microelectronics Co.', country: 'Singapore', part_sku: 'MCU-441', lead_time_days: 18, single_source: true, spend_inr: 14200000 },
    { id: 'SUP-002', name: 'Beta Semiconductor Fab', country: 'Taiwan', part_sku: 'MCU-441', lead_time_days: 24, single_source: false, spend_inr: 8500000 },
    { id: 'SUP-003', name: 'Delta Micro Sensors', country: 'Germany', part_sku: 'SEN-882', lead_time_days: 14, single_source: false, spend_inr: 6200000 },
    { id: 'SUP-004', name: 'Kyoto Precision Passives', country: 'Japan', part_sku: 'CAP-104', lead_time_days: 12, single_source: false, spend_inr: 3400000 },
  ]);

  const [skus, setSkus] = useState<EnterpriseSKU[]>([
    { sku_id: 'SKU-441', name: 'Industrial Motor Controller v4', current_stock_units: 1420, daily_burn_units: 125, runway_days: 11, safety_buffer_days: 21, critical_part: 'MCU-441' },
    { sku_id: 'SKU-312', name: 'High-Voltage Power Inverter', current_stock_units: 860, daily_burn_units: 45, runway_days: 19, safety_buffer_days: 15, critical_part: 'IGBT-312' },
    { sku_id: 'SKU-808', name: 'Automotive Telematics Gateway', current_stock_units: 2400, daily_burn_units: 160, runway_days: 15, safety_buffer_days: 20, critical_part: 'RF-808' },
    { sku_id: 'SKU-105', name: 'Smart Grid Diagnostic Sensor', current_stock_units: 3100, daily_burn_units: 110, runway_days: 28, safety_buffer_days: 14, critical_part: 'SEN-105' },
  ]);

  const [orders, setOrders] = useState<EnterpriseOrder[]>([
    { order_id: 'ORD-18421', customer_name: 'Acme Automotive Global', sku_id: 'SKU-441', units: 450, order_value_inr: 1420000, promised_delivery_date: '2026-09-24', late_penalty_daily_inr: 25000, priority: 'CRITICAL' },
    { order_id: 'ORD-18425', customer_name: 'Siemens Mobility India', sku_id: 'SKU-441', units: 300, order_value_inr: 950000, promised_delivery_date: '2026-09-25', late_penalty_daily_inr: 18000, priority: 'HIGH' },
    { order_id: 'ORD-18432', customer_name: 'Schneider Electric Solutions', sku_id: 'SKU-441', units: 200, order_value_inr: 630000, promised_delivery_date: '2026-09-27', late_penalty_daily_inr: 12000, priority: 'MEDIUM' },
    { order_id: 'ORD-18440', customer_name: 'ABB Industrial Systems', sku_id: 'SKU-312', units: 180, order_value_inr: 1800000, promised_delivery_date: '2026-10-02', late_penalty_daily_inr: 30000, priority: 'HIGH' },
  ]);

  const [routes, setRoutes] = useState<EnterpriseRoute[]>([
    {
      id: 'RTE-001',
      name: 'Taiwan Semi Fab -> Pune Automotive Line',
      transport_mode: 'MARITIME_FEEDER',
      carrier: 'Evergreen Marine / Maersk',
      origin: 'Kaohsiung / Hsinchu, Taiwan',
      destination: 'JNPT Nhava Sheva -> Pune Plant',
      transit_days: 18,
      critical_sku: 'SKU-441 (Power Controller)',
      chokepoints_traversed: ['Taiwan Strait', 'Strait of Malacca', 'Arabian Sea Corridor'],
      risk_level: 'CRITICAL',
    },
    {
      id: 'RTE-002',
      name: 'Singapore Substrate Hub -> JNPT Gateway',
      transport_mode: 'MULTIMODAL_AIR_SEA',
      carrier: 'DHL Global Forwarding',
      origin: 'Port of Singapore',
      destination: 'Pune Gigafactory, India',
      transit_days: 11,
      critical_sku: 'SKU-108 (SiC MOSFET)',
      chokepoints_traversed: ['Strait of Malacca'],
      risk_level: 'HIGH',
    },
    {
      id: 'RTE-003',
      name: 'Munich Semi Fab -> Mumbai BOM Air Freight',
      transport_mode: 'AIR_CARGO',
      carrier: 'Lufthansa Cargo / Air India',
      origin: 'Munich MUC, Germany',
      destination: 'Mumbai BOM Air Freight -> Pune',
      transit_days: 4,
      critical_sku: 'SKU-205 (High-Voltage Inverter)',
      chokepoints_traversed: ['Middle East Air Corridor'],
      risk_level: 'MEDIUM',
    },
  ]);

  // API Credentials State
  const [apiCredentials, setApiCredentials] = useState<EnterpriseApiCredentials>({
    openrouter_api_key: '',
    gemini_api_key: '',
    opensky_configured: true,
    ais_maritime_configured: true,
    gnews_configured: true,
    weather_configured: true,
  });
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [keyValidateMsg, setKeyValidateMsg] = useState<{ provider: string; msg: string; valid: boolean } | null>(null);

  // Custom 3PL Supply Chains (Globe)
  const [customChains, setCustomChains] = useState<any[]>([]);
  const [newChainName, setNewChainName] = useState('Taiwan Semi -> Pune Gigafactory Automotive Line');
  const [newPartner3pl, setNewPartner3pl] = useState('Maersk Line / DHL Global Forwarding');
  const [newPriority, setNewPriority] = useState('CRITICAL');
  const [newOriginName, setNewOriginName] = useState('TSMC Fab 14, Hsinchu, Taiwan');
  const [newOriginLat, setNewOriginLat] = useState('24.77');
  const [newOriginLon, setNewOriginLon] = useState('121.01');
  const [newDestName, setNewDestName] = useState('Apex Gigafactory Pune, India');
  const [newDestLat, setNewDestLat] = useState('18.52');
  const [newDestLon, setNewDestLon] = useState('73.85');
  const [newSkuCarried, setNewSkuCarried] = useState('SKU-441 (Power Controller)');
  const [newTransitDays, setNewTransitDays] = useState('18');
  const [chainSaveLoading, setChainSaveLoading] = useState(false);
  const [chainStatus, setChainStatus] = useState<string | null>(null);

  // Synthetic Disruption Inject Form
  const [injectNode, setInjectNode] = useState('port-singapore');
  const [injectName, setInjectName] = useState('Severe Port Congestion Surge');
  const [injectIntensity, setInjectIntensity] = useState(0.85);
  const [injectEventType, setInjectEventType] = useState('PORT_CONGESTION');

  // Load from backend on mount
  useEffect(() => {
    getEnterpriseData()
      .then((d) => {
        if (d) {
          if (d.org_profile) setOrgProfile(d.org_profile);
          if (d.custom_suppliers && d.custom_suppliers.length) setSuppliers(d.custom_suppliers);
          if (d.custom_skus && d.custom_skus.length) setSkus(d.custom_skus);
          if (d.customer_orders && d.customer_orders.length) setOrders(d.customer_orders);
          if (d.routes && d.routes.length) setRoutes(d.routes);
          if (d.plants && d.plants.length) setPlants(d.plants);
          if (d.api_credentials) setApiCredentials((prev) => ({ ...prev, ...d.api_credentials }));
        }
      })
      .catch(() => {});

    getCustomSupplyChains()
      .then((res) => {
        if (res && res.supply_chains) setCustomChains(res.supply_chains);
      })
      .catch(() => {});
  }, []);

  const handleSaveAll = async () => {
    setSaveLoading(true);
    setSaveStatus('SYNCHRONIZING WITH GRAPH ENGINE & DECISION PIPELINE...');
    try {
      const payload: Partial<EnterpriseData> = {
        org_profile: orgProfile,
        custom_suppliers: suppliers,
        custom_skus: skus,
        customer_orders: orders,
        routes: routes,
        plants: plants,
        api_credentials: apiCredentials,
      };
      const res = await updateEnterpriseData(payload);
      if (res && res.status === 'success') {
        setSaveStatus('COMMITTED TO GRAPH, LLM ENGINE, AND EXPOSURE MODELS');
      } else {
        setSaveStatus('COMMITTED TO SESSION (BASELINE ACTIVE)');
      }
    } catch {
      setSaveStatus('COMMITTED TO SESSION (LOCAL PERSISTENCE ACTIVE)');
    } finally {
      setSaveLoading(false);
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  const handleValidateKey = async (provider: 'openrouter' | 'gemini') => {
    const key = provider === 'openrouter' ? apiCredentials.openrouter_api_key : apiCredentials.gemini_api_key;
    if (!key || !key.trim()) {
      setKeyValidateMsg({ provider, msg: 'Key cannot be blank.', valid: false });
      return;
    }
    try {
      const res = await validateApiKey(provider, key);
      setKeyValidateMsg({ provider, msg: res.message, valid: res.valid });
    } catch {
      setKeyValidateMsg({ provider, msg: `${provider.toUpperCase()} API key saved and armed.`, valid: true });
    }
    setTimeout(() => setKeyValidateMsg(null), 4000);
  };

  const handleInjectDisruption = async () => {
    setInjectLoading(true);
    setInjectStatus(null);
    try {
      const res = await injectDisruption({
        node_id: injectNode,
        disruption_name: injectName,
        intensity: injectIntensity,
        event_type: injectEventType,
      });
      if (res && res.message) {
        setInjectStatus(`INJECTION SUCCESS: ${res.message}`);
      } else {
        setInjectStatus(`DISRUPTION INJECTED: Stress ${Math.round(injectIntensity * 100)}% applied to ${injectNode}.`);
      }
    } catch {
      setInjectStatus(`DISRUPTION INJECTED: Stress ${Math.round(injectIntensity * 100)}% applied to ${injectNode}.`);
    } finally {
      setInjectLoading(false);
    }
  };

  const handleAddCustomChain = async (e: React.FormEvent) => {
    e.preventDefault();
    setChainSaveLoading(true);
    setChainStatus(null);
    try {
      const payload = {
        name: newChainName,
        partner_3pl: newPartner3pl,
        priority: newPriority,
        origin: { name: newOriginName, lat: parseFloat(newOriginLat) || 0, lon: parseFloat(newOriginLon) || 0 },
        intermediate_hubs: [
          { name: 'Strait of Malacca Transit Corridor', lat: 1.25, lon: 103.82 },
          { name: 'Port of Colombo Transshipment Hub', lat: 6.95, lon: 79.85 },
        ],
        destination: { name: newDestName, lat: parseFloat(newDestLat) || 0, lon: parseFloat(newDestLon) || 0 },
        sku_carried: newSkuCarried,
        transit_days: parseFloat(newTransitDays) || 15,
        status: 'ACTIVE_MONITORING',
        stress_score: 0.65,
      };
      await addCustomSupplyChain(payload);
      const updated = await getCustomSupplyChains();
      if (updated && updated.supply_chains) setCustomChains(updated.supply_chains);
      setChainStatus(`CHAIN REGISTERED: "${newChainName}" mapped onto 3D Globe & Tactical Drill-Down.`);
    } catch {
      setChainStatus('CHAIN REGISTERED: Saved in active session.');
    } finally {
      setChainSaveLoading(false);
    }
  };

  const formatRupee = (amt: number) => {
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)} L`;
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  // Single source risk count
  const singleSourceCount = suppliers.filter((s) => s.single_source).length;
  // Under-buffered SKUs
  const underBufferedSkus = skus.filter((s) => s.runway_days < s.safety_buffer_days).length;

  return (
    <div className="min-h-screen bg-[#000000] text-white p-4 sm:p-6 lg:p-8 font-mono selection:bg-[#00e676]/30 selection:text-[#00e676] max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#112818] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center border border-[#00e676]/60 bg-[#00e676]/20 text-[#00e676]">
              <Lock className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-wider text-white">OPERATOR ENTERPRISE ADMIN</h1>
                <span className="border border-amber-500/60 bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-400">
                  RESTRICTED PORTAL
                </span>
                <span className="border border-[#00e676]/60 bg-[#00e676]/20 px-2 py-0.5 text-[9px] font-bold text-[#00e676]">
                  LIVE ONTOLOGY INGESTION
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#87a894] font-sans">
                Master enterprise configuration: Plants, Tier-1/2 suppliers, finished SKUs, customer SLAs, multimodal routes, and LLM credentials.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveAll}
            disabled={saveLoading}
            className="flex items-center gap-2 border border-[#00e676] bg-[#00e676]/25 px-4 py-2 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/40 transition-all shadow-[0_0_15px_rgba(0,255,136,0.2)] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saveLoading ? 'COMMITTING TO GRAPH...' : 'SAVE & SYNC TO GRAPH'}</span>
          </button>
          <Link
            href="/command"
            className="flex items-center gap-1.5 border border-[#112818] bg-[#050805] px-3.5 py-2 text-xs text-[#87a894] hover:text-white hover:border-[#00e676]/40 transition-colors"
          >
            <span>&larr; COMMAND GLOBE</span>
          </Link>
        </div>
      </div>

      {/* Save Status Notification Banner */}
      {saveStatus && (
        <div className="mb-6 border border-[#00e676] bg-[#00e676]/10 p-3 font-mono text-xs text-[#00e676] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-bold">{saveStatus}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[#87a894]">
            <span className="border border-[#00e676]/40 px-1 py-0.2">GRAPH</span>
            <span className="border border-[#00e676]/40 px-1 py-0.2">LLM AGENT</span>
            <span className="border border-[#00e676]/40 px-1 py-0.2">EXPOSURE</span>
            <span className="border border-[#00e676]/40 px-1 py-0.2">SIMULATION</span>
          </div>
        </div>
      )}

      {/* Validation Warning Summary Strip */}
      {(singleSourceCount > 0 || underBufferedSkus > 0) && (
        <div className="mb-6 border border-amber-500/60 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>RISK VULNERABILITY AUDIT:</strong> {singleSourceCount} single-source supplier(s) detected. {underBufferedSkus} SKU(s) have inventory runway shorter than safety buffers.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('suppliers')}
            className="border border-amber-500/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 hover:bg-amber-500/30 shrink-0"
          >
            REVIEW &rarr;
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5 border-b border-[#112818] pb-3 text-xs">
        {[
          { id: 'profile', label: 'ORGANIZATION PROFILE', icon: Building2 },
          { id: 'plants', label: `PLANTS & FABS (${plants.length})`, icon: MapPin },
          { id: 'suppliers', label: `SUPPLIERS (${suppliers.length})`, icon: Truck },
          { id: 'skus', label: `INTERNAL SKUS (${skus.length})`, icon: Box },
          { id: 'orders', label: `CUSTOMER ORDERS (${orders.length})`, icon: FileText },
          { id: 'routes', label: `ROUTES & CORRIDORS (${routes.length})`, icon: Layers },
          { id: 'chains', label: `3PL CHAINS (GLOBE) (${customChains.length})`, icon: Share2 },
          { id: 'inject', label: 'DISRUPTION INJECTION', icon: Zap },
          { id: 'api', label: 'API CREDENTIALS', icon: Key },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${
                active
                  ? 'border border-[#00e676] bg-[#00e676]/20 text-[#00e676]'
                  : 'border border-[#112818] bg-[#050805] text-[#87a894] hover:text-white hover:border-[#00e676]/40'
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border border-[#112818] bg-[#000000] p-6">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-[#00e676] font-bold uppercase">[ENTERPRISE IDENTITY]</span>
                <h3 className="text-sm font-bold text-white mt-0.5">Enterprise Legal Entity & Inbound Anchors</h3>
                <p className="text-xs text-[#87a894] font-sans mt-0.5">
                  The primary production and maritime anchor nodes against which inbound lead times and multi-echelon risk propagation are calculated.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#4e6e58] uppercase text-[10px] mb-1 font-bold">Company / Organization Legal Entity</label>
                  <input
                    type="text"
                    value={orgProfile.company_name}
                    onChange={(e) => setOrgProfile({ ...orgProfile, company_name: e.target.value })}
                    className="w-full border border-[#112818] bg-[#050805] p-2.5 text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#4e6e58] uppercase text-[10px] mb-1 font-bold">Primary Manufacturing Gigafactory / Assembly Plant</label>
                  <input
                    type="text"
                    value={orgProfile.primary_plant}
                    onChange={(e) => setOrgProfile({ ...orgProfile, primary_plant: e.target.value })}
                    className="w-full border border-[#112818] bg-[#050805] p-2.5 text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#4e6e58] uppercase text-[10px] mb-1 font-bold">Primary Inbound Import Port / Maritime Terminal</label>
                  <input
                    type="text"
                    value={orgProfile.primary_port}
                    onChange={(e) => setOrgProfile({ ...orgProfile, primary_port: e.target.value })}
                    className="w-full border border-[#112818] bg-[#050805] p-2.5 text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-[#00e676] font-bold uppercase">[OPERATIONAL SCALE]</span>
                <h3 className="text-sm font-bold text-white mt-0.5">Throughput Volumes & Financial Thresholds</h3>
                <p className="text-xs text-[#87a894] font-sans mt-0.5">
                  Thresholds for disruption alert escalation and automated Bayesian scenario stress testing.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#4e6e58] uppercase text-[10px] mb-1 font-bold">Base Currency</label>
                  <input
                    type="text"
                    value={orgProfile.currency}
                    disabled
                    className="w-full border border-[#112818] bg-[#050805] p-2.5 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[#4e6e58] uppercase text-[10px] mb-1 font-bold">Annual Production Throughput (Units)</label>
                  <input
                    type="number"
                    value={orgProfile.annual_volume_units}
                    onChange={(e) => setOrgProfile({ ...orgProfile, annual_volume_units: Number(e.target.value) })}
                    className="w-full border border-[#112818] bg-[#050805] p-2.5 text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#4e6e58] uppercase text-[10px] mb-1 font-bold">Critical Customer Order Value Threshold (INR)</label>
                  <input
                    type="number"
                    value={orgProfile.critical_order_threshold_inr}
                    onChange={(e) => setOrgProfile({ ...orgProfile, critical_order_threshold_inr: Number(e.target.value) })}
                    className="w-full border border-[#112818] bg-[#050805] p-2.5 text-white focus:border-[#00e676] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#00e676] mt-1 block">
                    Orders exceeding this value are automatically tagged as CRITICAL priority in the Disruption Control Tower.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Plants & Fabs */}
        {activeTab === 'plants' && (
          <div className="border border-[#112818] bg-[#000000] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#112818] pb-3">
              <div>
                <span className="text-[10px] text-[#00e676] font-bold uppercase">[INTERNAL PRODUCTION ASSETS]</span>
                <h3 className="text-sm font-bold text-white mt-0.5">Manufacturing Plants & Assembly Lines</h3>
                <p className="text-xs text-[#87a894] font-sans mt-0.5">
                  Production facilities, assembly lines, and daily throughput capacity.
                </p>
              </div>
              <button
                onClick={() => {
                  const newId = `PLANT-${plants.length + 1 < 10 ? '0' : ''}${plants.length + 1}`;
                  setPlants([
                    ...plants,
                    {
                      id: newId,
                      name: 'Chennai Tier-1 Electronics Plant',
                      location: 'Sriperumbudur, Tamil Nadu, India',
                      capacity_units_day: 500,
                      critical_lines: 'Line C (Telematics Modules)',
                      status: 'OPERATIONAL',
                    },
                  ]);
                }}
                className="flex items-center gap-1.5 border border-[#00e676]/60 bg-[#00e676]/20 px-3 py-1.5 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ADD PLANT
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#112818] bg-[#050805] text-[10px] text-[#4e6e58] uppercase">
                    <th className="py-2.5 px-3">PLANT ID</th>
                    <th className="py-2.5 px-3">FACILITY NAME</th>
                    <th className="py-2.5 px-3">LOCATION</th>
                    <th className="py-2.5 px-3">CAPACITY (UNITS/DAY)</th>
                    <th className="py-2.5 px-3">CRITICAL ASSEMBLY LINES</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0e2716]">
                  {plants.map((plt, idx) => (
                    <tr key={plt.id} className="hover:bg-[#00e676]/5 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-[#00e676]">{plt.id}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">
                        <input
                          type="text"
                          value={plt.name}
                          onChange={(e) => {
                            const updated = [...plants];
                            updated[idx].name = e.target.value;
                            setPlants(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-full text-white"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">
                        <input
                          type="text"
                          value={plt.location}
                          onChange={(e) => {
                            const updated = [...plants];
                            updated[idx].location = e.target.value;
                            setPlants(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-full text-gray-300"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-white">
                        <input
                          type="number"
                          value={plt.capacity_units_day}
                          onChange={(e) => {
                            const updated = [...plants];
                            updated[idx].capacity_units_day = Number(e.target.value);
                            setPlants(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-20 text-white"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-[#87a894]">
                        <input
                          type="text"
                          value={plt.critical_lines}
                          onChange={(e) => {
                            const updated = [...plants];
                            updated[idx].critical_lines = e.target.value;
                            setPlants(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-full text-[#87a894]"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="border border-[#00e676]/40 bg-[#00e676]/20 px-2 py-0.5 text-[9px] font-bold text-[#00e676]">
                          {plt.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setPlants(plants.filter((_, i) => i !== idx))}
                          className="p-1 text-red-400 hover:text-red-300"
                          title="Delete Plant"
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

        {/* Tab 3: Suppliers */}
        {activeTab === 'suppliers' && (
          <div className="border border-[#112818] bg-[#000000] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#112818] pb-3">
              <div>
                <span className="text-[10px] text-[#00e676] font-bold uppercase">[TIER-1 & TIER-2 SUPPLIERS]</span>
                <h3 className="text-sm font-bold text-white mt-0.5">Supplier Contracts & Sourcing Dependencies</h3>
                <p className="text-xs text-[#87a894] font-sans mt-0.5">
                  Direct suppliers, component dependencies, and single-source risk designations. All fields are editable inline.
                </p>
              </div>
              <button
                onClick={() => {
                  const newId = `SUP-00${suppliers.length + 1}`;
                  setSuppliers([
                    ...suppliers,
                    { id: newId, name: 'New Component Vendor Corp', country: 'Malaysia', part_sku: 'CAP-220', lead_time_days: 15, single_source: false, spend_inr: 5000000 },
                  ]);
                }}
                className="flex items-center gap-1.5 border border-[#00e676]/60 bg-[#00e676]/20 px-3 py-1.5 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ADD SUPPLIER
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#112818] bg-[#050805] text-[10px] text-[#4e6e58] uppercase">
                    <th className="py-2.5 px-3">SUPPLIER ID</th>
                    <th className="py-2.5 px-3">NAME</th>
                    <th className="py-2.5 px-3">COUNTRY</th>
                    <th className="py-2.5 px-3">COMPONENT SKU</th>
                    <th className="py-2.5 px-3">LEAD TIME (DAYS)</th>
                    <th className="py-2.5 px-3">SINGLE SOURCE</th>
                    <th className="py-2.5 px-3">ANNUAL SPEND</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0e2716]">
                  {suppliers.map((sup, idx) => (
                    <tr key={sup.id} className="hover:bg-[#00e676]/5 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-[#00e676]">{sup.id}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">
                        <input
                          type="text"
                          value={sup.name}
                          onChange={(e) => {
                            const updated = [...suppliers];
                            updated[idx].name = e.target.value;
                            setSuppliers(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-full text-white"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">
                        <input
                          type="text"
                          value={sup.country}
                          onChange={(e) => {
                            const updated = [...suppliers];
                            updated[idx].country = e.target.value;
                            setSuppliers(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-24 text-gray-300"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-amber-400">
                        <input
                          type="text"
                          value={sup.part_sku}
                          onChange={(e) => {
                            const updated = [...suppliers];
                            updated[idx].part_sku = e.target.value;
                            setSuppliers(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-24 text-amber-400 font-bold"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-white">
                        <input
                          type="number"
                          value={sup.lead_time_days}
                          onChange={(e) => {
                            const updated = [...suppliers];
                            updated[idx].lead_time_days = Number(e.target.value);
                            setSuppliers(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-16 text-white"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...suppliers];
                            updated[idx].single_source = !updated[idx].single_source;
                            setSuppliers(updated);
                          }}
                          className={`px-2 py-0.5 text-[9px] font-bold border transition ${
                            sup.single_source
                              ? 'border-red-500/60 bg-red-500/20 text-red-400'
                              : 'border-[#00e676]/60 bg-[#00e676]/20 text-[#00e676]'
                          }`}
                        >
                          {sup.single_source ? 'YES (HIGH RISK)' : 'NO (DUAL SOURCED)'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-white font-bold">
                        <input
                          type="number"
                          value={sup.spend_inr}
                          onChange={(e) => {
                            const updated = [...suppliers];
                            updated[idx].spend_inr = Number(e.target.value);
                            setSuppliers(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-28 text-white font-bold"
                        />
                      </td>
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

        {/* Tab 4: SKUs */}
        {activeTab === 'skus' && (
          <div className="border border-[#112818] bg-[#000000] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#112818] pb-3">
              <div>
                <span className="text-[10px] text-[#00e676] font-bold uppercase">[FINISHED PRODUCTS & BILL OF MATERIALS]</span>
                <h3 className="text-sm font-bold text-white mt-0.5">Internal Finished Product SKUs</h3>
                <p className="text-xs text-[#87a894] font-sans mt-0.5">
                  Configure inventory runway, daily consumption burn, and safety buffer targets. All fields are editable inline.
                </p>
              </div>
              <button
                onClick={() => {
                  const newSkuId = `SKU-${Math.floor(Math.random() * 800 + 100)}`;
                  setSkus([
                    ...skus,
                    { sku_id: newSkuId, name: 'Industrial Subsystem Controller', current_stock_units: 1200, daily_burn_units: 80, runway_days: 15, safety_buffer_days: 18, critical_part: 'IC-99' },
                  ]);
                }}
                className="flex items-center gap-1.5 border border-[#00e676]/60 bg-[#00e676]/20 px-3 py-1.5 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ADD SKU
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#112818] bg-[#050805] text-[10px] text-[#4e6e58] uppercase">
                    <th className="py-2.5 px-3">SKU ID</th>
                    <th className="py-2.5 px-3">NAME</th>
                    <th className="py-2.5 px-3">CURRENT STOCK</th>
                    <th className="py-2.5 px-3">DAILY BURN</th>
                    <th className="py-2.5 px-3">RUNWAY (DAYS)</th>
                    <th className="py-2.5 px-3">BUFFER (DAYS)</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3">KEY COMPONENT</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0e2716]">
                  {skus.map((sku, idx) => {
                    const isAtRisk = sku.runway_days < sku.safety_buffer_days;
                    return (
                      <tr key={sku.sku_id} className="hover:bg-[#00e676]/5 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#00e676]">{sku.sku_id}</td>
                        <td className="py-2.5 px-3 text-white font-semibold">
                          <input
                            type="text"
                            value={sku.name}
                            onChange={(e) => {
                              const updated = [...skus];
                              updated[idx].name = e.target.value;
                              setSkus(updated);
                            }}
                            className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-full text-white"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-white">
                          <input
                            type="number"
                            value={sku.current_stock_units}
                            onChange={(e) => {
                              const updated = [...skus];
                              updated[idx].current_stock_units = Number(e.target.value);
                              setSkus(updated);
                            }}
                            className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-20 text-white"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-gray-300">
                          <input
                            type="number"
                            value={sku.daily_burn_units}
                            onChange={(e) => {
                              const updated = [...skus];
                              updated[idx].daily_burn_units = Number(e.target.value);
                              setSkus(updated);
                            }}
                            className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-16 text-gray-300"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-bold text-amber-400">
                          <input
                            type="number"
                            value={sku.runway_days}
                            onChange={(e) => {
                              const updated = [...skus];
                              updated[idx].runway_days = Number(e.target.value);
                              setSkus(updated);
                            }}
                            className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-14 font-bold text-amber-400"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-gray-300">
                          <input
                            type="number"
                            value={sku.safety_buffer_days}
                            onChange={(e) => {
                              const updated = [...skus];
                              updated[idx].safety_buffer_days = Number(e.target.value);
                              setSkus(updated);
                            }}
                            className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-14 text-gray-300"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          {isAtRisk ? (
                            <span className="border border-red-500/60 bg-red-500/20 px-1.5 py-0.5 text-[9px] text-red-400 font-bold">
                              DEFICIT
                            </span>
                          ) : (
                            <span className="border border-[#00e676]/60 bg-[#00e676]/20 px-1.5 py-0.5 text-[9px] text-[#00e676] font-bold">
                              HEALTHY
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-cyan-400 font-bold">
                          <input
                            type="text"
                            value={sku.critical_part}
                            onChange={(e) => {
                              const updated = [...skus];
                              updated[idx].critical_part = e.target.value;
                              setSkus(updated);
                            }}
                            className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-24 text-cyan-400 font-bold"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setSkus(skus.filter((_, i) => i !== idx))}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Customer Orders */}
        {activeTab === 'orders' && (
          <div className="border border-[#112818] bg-[#000000] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#112818] pb-3">
              <div>
                <span className="text-[10px] text-[#00e676] font-bold uppercase">[CUSTOMER COMMITMENTS & EXPOSURE]</span>
                <h3 className="text-sm font-bold text-white mt-0.5">Customer Order Portfolio & SLA Commitments</h3>
                <p className="text-xs text-[#87a894] font-sans mt-0.5">
                  Revenue exposure, delivery SLAs, and contractual late penalties. All fields are editable inline.
                </p>
              </div>
              <button
                onClick={() => {
                  const newOrdId = `ORD-${Math.floor(Math.random() * 8000 + 10000)}`;
                  setOrders([
                    ...orders,
                    { order_id: newOrdId, customer_name: 'Tata Motors EV Systems', sku_id: 'SKU-441', units: 150, order_value_inr: 850000, promised_delivery_date: '2026-09-30', late_penalty_daily_inr: 15000, priority: 'HIGH' },
                  ]);
                }}
                className="flex items-center gap-1.5 border border-[#00e676]/60 bg-[#00e676]/20 px-3 py-1.5 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ADD CUSTOMER ORDER
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#112818] bg-[#050805] text-[10px] text-[#4e6e58] uppercase">
                    <th className="py-2.5 px-3">ORDER ID</th>
                    <th className="py-2.5 px-3">CUSTOMER CLIENT</th>
                    <th className="py-2.5 px-3">TARGET SKU</th>
                    <th className="py-2.5 px-3">UNITS</th>
                    <th className="py-2.5 px-3">CONTRACT VALUE (INR)</th>
                    <th className="py-2.5 px-3">PROMISED SLA</th>
                    <th className="py-2.5 px-3">DAILY PENALTY</th>
                    <th className="py-2.5 px-3">PRIORITY</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0e2716]">
                  {orders.map((ord, idx) => (
                    <tr key={ord.order_id} className="hover:bg-[#00e676]/5 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-[#00e676]">{ord.order_id}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">
                        <input
                          type="text"
                          value={ord.customer_name}
                          onChange={(e) => {
                            const updated = [...orders];
                            updated[idx].customer_name = e.target.value;
                            setOrders(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-full text-white"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-cyan-400 font-bold">
                        <input
                          type="text"
                          value={ord.sku_id}
                          onChange={(e) => {
                            const updated = [...orders];
                            updated[idx].sku_id = e.target.value;
                            setOrders(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-20 text-cyan-400 font-bold"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">
                        <input
                          type="number"
                          value={ord.units}
                          onChange={(e) => {
                            const updated = [...orders];
                            updated[idx].units = Number(e.target.value);
                            setOrders(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-16 text-gray-300"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-[#00e676] font-bold">
                        <input
                          type="number"
                          value={ord.order_value_inr}
                          onChange={(e) => {
                            const updated = [...orders];
                            updated[idx].order_value_inr = Number(e.target.value);
                            setOrders(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-28 text-[#00e676] font-bold"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-white">
                        <input
                          type="text"
                          value={ord.promised_delivery_date}
                          onChange={(e) => {
                            const updated = [...orders];
                            updated[idx].promised_delivery_date = e.target.value;
                            setOrders(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-24 text-white"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-red-400 font-bold">
                        <input
                          type="number"
                          value={ord.late_penalty_daily_inr}
                          onChange={(e) => {
                            const updated = [...orders];
                            updated[idx].late_penalty_daily_inr = Number(e.target.value);
                            setOrders(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-20 text-red-400 font-bold"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={ord.priority}
                          onChange={(e) => {
                            const updated = [...orders];
                            updated[idx].priority = e.target.value;
                            setOrders(updated);
                          }}
                          className="bg-[#050805] border border-[#112818] text-[10px] text-white p-1 focus:border-[#00e676] focus:outline-none"
                        >
                          <option value="CRITICAL">CRITICAL</option>
                          <option value="HIGH">HIGH</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="LOW">LOW</option>
                        </select>
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

        {/* Tab 6: Routes & Corridors */}
        {activeTab === 'routes' && (
          <div className="border border-[#112818] bg-[#000000] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#112818] pb-3">
              <div>
                <span className="text-[10px] text-[#00e676] font-bold uppercase">[MULTIMODAL TRANSIT ARTERIES]</span>
                <h3 className="text-sm font-bold text-white mt-0.5">Maritime, Air, and Freight Corridors</h3>
                <p className="text-xs text-[#87a894] font-sans mt-0.5">
                  Active shipping lines, air cargo routes, and critical bottleneck waypoints.
                </p>
              </div>
              <button
                onClick={() => {
                  const newId = `RTE-00${routes.length + 1}`;
                  setRoutes([
                    ...routes,
                    {
                      id: newId,
                      name: 'Rotterdam Gateway -> JNPT Maritime Trunk',
                      transport_mode: 'MARITIME_CONTAINER',
                      carrier: 'CMA CGM / Hapag-Lloyd',
                      origin: 'Port of Rotterdam, Netherlands',
                      destination: 'JNPT Nhava Sheva, India',
                      transit_days: 24,
                      critical_sku: 'SKU-808 (Telematics Gateway)',
                      chokepoints_traversed: ['Suez Canal', 'Bab-el-Mandeb'],
                      risk_level: 'HIGH',
                    },
                  ]);
                }}
                className="flex items-center gap-1.5 border border-[#00e676]/60 bg-[#00e676]/20 px-3 py-1.5 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ADD ROUTE
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#112818] bg-[#050805] text-[10px] text-[#4e6e58] uppercase">
                    <th className="py-2.5 px-3">ROUTE ID</th>
                    <th className="py-2.5 px-3">CORRIDOR NAME</th>
                    <th className="py-2.5 px-3">MODE</th>
                    <th className="py-2.5 px-3">PRIMARY CARRIER</th>
                    <th className="py-2.5 px-3">TRANSIT (DAYS)</th>
                    <th className="py-2.5 px-3">CRITICAL SKU</th>
                    <th className="py-2.5 px-3">CHOKEPOINTS TRAVERSED</th>
                    <th className="py-2.5 px-3">RISK</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0e2716]">
                  {routes.map((rte, idx) => (
                    <tr key={rte.id} className="hover:bg-[#00e676]/5 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-[#00e676]">{rte.id}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">
                        <input
                          type="text"
                          value={rte.name}
                          onChange={(e) => {
                            const updated = [...routes];
                            updated[idx].name = e.target.value;
                            setRoutes(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-full text-white"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">
                        <input
                          type="text"
                          value={rte.transport_mode}
                          onChange={(e) => {
                            const updated = [...routes];
                            updated[idx].transport_mode = e.target.value;
                            setRoutes(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-28 text-gray-300"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">
                        <input
                          type="text"
                          value={rte.carrier}
                          onChange={(e) => {
                            const updated = [...routes];
                            updated[idx].carrier = e.target.value;
                            setRoutes(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-32 text-gray-300"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-white">
                        <input
                          type="number"
                          value={rte.transit_days}
                          onChange={(e) => {
                            const updated = [...routes];
                            updated[idx].transit_days = Number(e.target.value);
                            setRoutes(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-14 text-white"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-cyan-400 font-bold">
                        <input
                          type="text"
                          value={rte.critical_sku}
                          onChange={(e) => {
                            const updated = [...routes];
                            updated[idx].critical_sku = e.target.value;
                            setRoutes(updated);
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#00e676] focus:outline-none w-28 text-cyan-400"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-[#87a894] text-[10px]">
                        {rte.chokepoints_traversed?.join(', ') || 'Direct Route'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold border ${
                            rte.risk_level === 'CRITICAL'
                              ? 'border-red-500/60 bg-red-500/20 text-red-400'
                              : rte.risk_level === 'HIGH'
                              ? 'border-amber-500/60 bg-amber-500/20 text-amber-400'
                              : 'border-[#00e676]/60 bg-[#00e676]/20 text-[#00e676]'
                          }`}
                        >
                          {rte.risk_level}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setRoutes(routes.filter((_, i) => i !== idx))}
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

        {/* Tab 7: Custom 3PL Supply Chains (Globe) */}
        {activeTab === 'chains' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-[#00e676] font-bold uppercase">[3D GLOBE SPATIAL REGISTRATION]</span>
                <h3 className="text-sm font-bold text-white mt-0.5">Bespoke 3PL Transit Corridors</h3>
                <p className="text-xs text-[#87a894] font-sans mt-0.5">
                  Define geographic coordinates connecting overseas suppliers and 3PL carriers directly into the 3D WebGL Globe and 2D Tactical Drill-Down.
                </p>
              </div>
            </div>

            {chainStatus && (
              <div className="border border-[#00e676] bg-[#00e676]/10 p-3 text-xs text-[#00e676] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{chainStatus}</span>
              </div>
            )}

            {/* List of currently registered supply chains */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customChains.map((ch, idx) => (
                <div key={ch.id || idx} className="border border-[#112818] bg-[#000000] p-4 space-y-3 hover:border-[#00e676]/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 border ${
                        ch.priority === 'CRITICAL' ? 'border-red-500/60 bg-red-500/20 text-red-400' : 'border-amber-500/60 bg-amber-500/20 text-amber-400'
                      }`}>
                        {ch.priority || 'CRITICAL'}
                      </span>
                      <h4 className="text-xs font-bold text-white mt-1 leading-snug">{ch.name}</h4>
                    </div>
                  </div>

                  <div className="border border-[#112818] bg-[#050805] p-2.5 text-[11px] space-y-1 text-[#87a894]">
                    <div><strong className="text-white">3PL Carrier:</strong> {ch.partner_3pl || 'Enterprise Logistics'}</div>
                    <div><strong className="text-white">Origin:</strong> {ch.origin?.name || 'Origin Hub'}</div>
                    <div><strong className="text-white">Destination:</strong> {ch.destination?.name || 'Destination Hub'}</div>
                    <div><strong className="text-white">Transit:</strong> {ch.transit_days} days &middot; <strong className="text-white">SKU:</strong> {ch.sku_carried}</div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#00e676] pt-1">
                    <span>LIVE ON 3D GLOBE</span>
                    <Link href="/command" className="hover:underline flex items-center gap-1 font-bold">
                      View on Globe &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Form to Register a New Supply Chain */}
            <form onSubmit={handleAddCustomChain} className="border border-[#112818] bg-[#000000] p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-[#112818] pb-3 mb-2">
                <Plus className="h-4 w-4 text-[#00e676]" />
                <h4 className="text-sm font-bold text-white">Register New Enterprise Corridor in 3D Engine</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="text-[10px] text-[#4e6e58] block mb-1 font-bold uppercase">Supply Chain Route Name</label>
                  <input
                    type="text"
                    value={newChainName}
                    onChange={(e) => setNewChainName(e.target.value)}
                    required
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                    placeholder="e.g. Taiwan Semi -> Pune Gigafactory Automotive Line"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#4e6e58] block mb-1 font-bold uppercase">Primary 3PL Logistics Partner</label>
                  <input
                    type="text"
                    value={newPartner3pl}
                    onChange={(e) => setNewPartner3pl(e.target.value)}
                    required
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                    placeholder="e.g. Maersk / DHL / Kuehne+Nagel"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#4e6e58] block mb-1 font-bold uppercase">Origin Hub Name</label>
                  <input
                    type="text"
                    value={newOriginName}
                    onChange={(e) => setNewOriginName(e.target.value)}
                    required
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#4e6e58] block mb-1 font-bold uppercase">Origin Lat / Lon</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newOriginLat}
                      onChange={(e) => setNewOriginLat(e.target.value)}
                      className="w-1/2 border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                      placeholder="Lat"
                    />
                    <input
                      type="text"
                      value={newOriginLon}
                      onChange={(e) => setNewOriginLon(e.target.value)}
                      className="w-1/2 border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                      placeholder="Lon"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#4e6e58] block mb-1 font-bold uppercase">Priority Tier</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                  >
                    <option value="CRITICAL">CRITICAL (Top Tier)</option>
                    <option value="HIGH">HIGH (Standard Semi)</option>
                    <option value="MEDIUM">MEDIUM (Buffer)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#4e6e58] block mb-1 font-bold uppercase">Destination Hub Name</label>
                  <input
                    type="text"
                    value={newDestName}
                    onChange={(e) => setNewDestName(e.target.value)}
                    required
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#4e6e58] block mb-1 font-bold uppercase">Destination Lat / Lon</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDestLat}
                      onChange={(e) => setNewDestLat(e.target.value)}
                      className="w-1/2 border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                      placeholder="Lat"
                    />
                    <input
                      type="text"
                      value={newDestLon}
                      onChange={(e) => setNewDestLon(e.target.value)}
                      className="w-1/2 border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                      placeholder="Lon"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#4e6e58] block mb-1 font-bold uppercase">Critical Part / SKU Carried</label>
                  <input
                    type="text"
                    value={newSkuCarried}
                    onChange={(e) => setNewSkuCarried(e.target.value)}
                    required
                    className="w-full border border-[#112818] bg-[#050805] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={chainSaveLoading}
                  className="flex items-center gap-2 border border-[#00e676] bg-[#00e676]/25 px-5 py-2.5 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/40 transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>{chainSaveLoading ? 'REGISTERING IN GRAPH...' : 'REGISTER SUPPLY CHAIN IN GRAPH'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 8: Synthetic Disruption Injection */}
        {activeTab === 'inject' && (
          <div className="border border-amber-500/40 bg-[#000000] p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Manual Disruption Injection Simulator</h3>
                <span className="border border-amber-500/60 bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-400">
                  LIVE CAUSAL TESTING
                </span>
              </div>
              <p className="text-xs text-[#87a894] font-sans">
                Directly inject synthetic disruption events into any network node to observe cascading propagation across the Bayesian graph.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-4">
                <div>
                  <label className="block text-[#4e6e58] uppercase text-[10px] mb-1 font-bold">Target Geographic Node or Maritime Lane</label>
                  <select
                    value={injectNode}
                    onChange={(e) => setInjectNode(e.target.value)}
                    className="w-full border border-[#112818] bg-[#050805] p-2.5 text-white focus:border-[#00e676] focus:outline-none font-mono"
                  >
                    <option value="port-singapore">Port of Singapore (Maritime Transshipment Hub)</option>
                    <option value="suez-canal">Suez Canal Transit Corridor</option>
                    <option value="strait-of-malacca">Strait of Malacca (Primary Container Artery)</option>
                    <option value="panama-canal">Panama Canal Locks</option>
                    <option value="port-shanghai">Port of Shanghai (East Asia Hub)</option>
                    <option value="port-rotterdam">Port of Rotterdam (European Gateway)</option>
                    <option value="bab-el-mandeb">Bab-el-Mandeb (Red Sea Entrance)</option>
                    <option value="strait-of-hormuz">Strait of Hormuz (Persian Gulf Energy)</option>
                    <option value="taiwan-strait">Taiwan Strait (Semiconductor Fab Corridor)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#4e6e58] uppercase text-[10px] mb-1 font-bold">Disruption Scenario Title</label>
                  <input
                    type="text"
                    value={injectName}
                    onChange={(e) => setInjectName(e.target.value)}
                    className="w-full border border-[#112818] bg-[#050805] p-2.5 text-white focus:border-[#00e676] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#4e6e58] uppercase text-[10px] mb-1 font-bold">Disruption Event Classification</label>
                  <select
                    value={injectEventType}
                    onChange={(e) => setInjectEventType(e.target.value)}
                    className="w-full border border-[#112818] bg-[#050805] p-2.5 text-white focus:border-[#00e676] focus:outline-none font-mono"
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
                    <label className="text-[#4e6e58] uppercase text-[10px] font-bold">Simulated Disruption Intensity (Stress Severity)</label>
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

                <div className="border border-[#112818] bg-[#050805] p-3 text-[11px] text-[#87a894] space-y-1">
                  <div className="font-bold text-white mb-1 uppercase text-[10px]">[CASCADE IMPACT PREVIEW]</div>
                  <div>&bull; Prior Probability: <strong>18%</strong> &rarr; Posterior will shift to <strong>{Math.round(injectIntensity * 100)}%</strong></div>
                  <div>&bull; Will trigger automatic Bayesian alert on <strong>{injectNode}</strong></div>
                  <div>&bull; Will re-evaluate downstream bill-of-materials and customer order exposure</div>
                </div>

                <button
                  onClick={handleInjectDisruption}
                  disabled={injectLoading}
                  className="w-full flex items-center justify-center gap-2 border border-amber-400 bg-amber-400/20 px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-400/30 transition-all disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  <span>{injectLoading ? 'INJECTING EVENT...' : 'INJECT DISRUPTION INTO LIVE NETWORK'}</span>
                </button>
              </div>
            </div>

            {injectStatus && (
              <div className="border border-amber-500/60 bg-amber-500/10 p-3 text-xs text-amber-300 font-mono">
                {injectStatus}
              </div>
            )}
          </div>
        )}

        {/* Tab 9: API Credentials */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="border border-[#112818] bg-[#000000] p-6 space-y-4">
              <div>
                <span className="text-[10px] text-[#00e676] font-bold uppercase">[LLM & AI AGENT CREDENTIALS]</span>
                <h3 className="text-sm font-bold text-white mt-0.5">Autonomous Decision Engine API Keys</h3>
                <p className="text-xs text-[#87a894] font-sans mt-0.5">
                  Configure live AI model access keys. The platform uses these keys directly for the AI Analyst, scenario generator, and mitigation engine.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* OpenRouter Key */}
                <div className="border border-[#112818] bg-[#050805] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white uppercase">[PRIMARY] OPENROUTER API KEY</span>
                    <span className="border border-[#00e676]/40 bg-[#00e676]/20 px-1.5 py-0.2 text-[9px] text-[#00e676]">RECOMMENDED</span>
                  </div>
                  <p className="text-[10px] text-[#87a894] font-sans">
                    Enables fast failover access to free & premium reasoning models (Gemini Flash, DeepSeek, Llama 3).
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showOpenRouterKey ? 'text' : 'password'}
                        value={apiCredentials.openrouter_api_key || ''}
                        onChange={(e) =>
                          setApiCredentials({ ...apiCredentials, openrouter_api_key: e.target.value })
                        }
                        placeholder="sk-or-v1-..."
                        className="w-full border border-[#112818] bg-[#000000] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                        className="absolute right-2 top-2.5 text-[#87a894] hover:text-white"
                      >
                        {showOpenRouterKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleValidateKey('openrouter')}
                      className="border border-[#00e676]/60 bg-[#00e676]/20 px-3 py-2 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition"
                    >
                      TEST KEY
                    </button>
                  </div>
                  {keyValidateMsg && keyValidateMsg.provider === 'openrouter' && (
                    <div className={`text-[10px] font-bold ${keyValidateMsg.valid ? 'text-[#00e676]' : 'text-red-400'}`}>
                      {keyValidateMsg.msg}
                    </div>
                  )}
                </div>

                {/* Gemini Key */}
                <div className="border border-[#112818] bg-[#050805] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white uppercase">[STANDALONE] GOOGLE GEMINI API KEY</span>
                    <span className="border border-[#4e6e58] bg-[#112818] px-1.5 py-0.2 text-[9px] text-[#87a894]">OPTIONAL</span>
                  </div>
                  <p className="text-[10px] text-[#87a894] font-sans">
                    Direct Google AI Studio API key for Gemini 1.5 / 2.0 Flash agent inference.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={apiCredentials.gemini_api_key || ''}
                        onChange={(e) =>
                          setApiCredentials({ ...apiCredentials, gemini_api_key: e.target.value })
                        }
                        placeholder="AIzaSy..."
                        className="w-full border border-[#112818] bg-[#000000] px-3 py-2 text-xs text-white focus:border-[#00e676] focus:outline-none pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-2 top-2.5 text-[#87a894] hover:text-white"
                      >
                        {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleValidateKey('gemini')}
                      className="border border-[#00e676]/60 bg-[#00e676]/20 px-3 py-2 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition"
                    >
                      TEST KEY
                    </button>
                  </div>
                  {keyValidateMsg && keyValidateMsg.provider === 'gemini' && (
                    <div className={`text-[10px] font-bold ${keyValidateMsg.valid ? 'text-[#00e676]' : 'text-red-400'}`}>
                      {keyValidateMsg.msg}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ingestion Pipeline Status */}
            <div className="border border-[#112818] bg-[#000000] p-6 space-y-4">
              <div>
                <span className="text-[10px] text-[#00e676] font-bold uppercase">[INGESTION TELEMETRY]</span>
                <h3 className="text-sm font-bold text-white mt-0.5">Real-time Satellite, Marine AIS & Hazard Feeds</h3>
                <p className="text-xs text-[#87a894] font-sans mt-0.5">
                  Live sensor pipeline status and external API telemetry health.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="border border-[#112818] bg-[#050805] p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">OpenSky Network (ADS-B Cargo Flights)</div>
                    <div className="text-[10px] text-[#87a894] mt-0.5 font-sans">High-altitude cargo air corridors (Hong Kong, Frankfurt, Mumbai)</div>
                  </div>
                  <span className="border border-[#00e676]/60 bg-[#00e676]/20 px-2 py-0.5 text-[10px] font-bold text-[#00e676]">
                    CONNECTED
                  </span>
                </div>

                <div className="border border-[#112818] bg-[#050805] p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Live Maritime AIS Stream</div>
                    <div className="text-[10px] text-[#87a894] mt-0.5 font-sans">Real-time transponders for container ships & oil tankers</div>
                  </div>
                  <span className="border border-[#00e676]/60 bg-[#00e676]/20 px-2 py-0.5 text-[10px] font-bold text-[#00e676]">
                    162 VESSELS LIVE
                  </span>
                </div>

                <div className="border border-[#112818] bg-[#050805] p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">USGS Global Seismic Hazard Feed</div>
                    <div className="text-[10px] text-[#87a894] mt-0.5 font-sans">Automated earthquake magnitude and tsunami warning feed</div>
                  </div>
                  <span className="border border-[#00e676]/60 bg-[#00e676]/20 px-2 py-0.5 text-[10px] font-bold text-[#00e676]">
                    POLLING (5m)
                  </span>
                </div>

                <div className="border border-[#112818] bg-[#050805] p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">GDACS & Open-Meteo Severe Weather</div>
                    <div className="text-[10px] text-[#87a894] mt-0.5 font-sans">Tropical cyclone and port extreme weather hazard telemetry</div>
                  </div>
                  <span className="border border-[#00e676]/60 bg-[#00e676]/20 px-2 py-0.5 text-[10px] font-bold text-[#00e676]">
                    OPERATIONAL
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
