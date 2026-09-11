'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Box,
  Truck,
  AlertTriangle,
  Clock,
  TrendingUp,
  ArrowRight,
  Search,
  Filter,
  Layers,
  Sparkles,
  ChevronRight,
  X,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { getSKUsExposure, getOrdersExposure } from '@/lib/api';
import type { SKUExposureItem, CustomerOrderExposureItem } from '@/lib/contracts';
import { MOCK_SKUS, MOCK_ORDERS } from '@/lib/mock';
import AIAnalystModal from '@/components/AIAnalystModal';

export default function ExposurePage() {
  const [skus, setSkus] = useState<SKUExposureItem[]>(MOCK_SKUS);
  const [orders, setOrders] = useState<CustomerOrderExposureItem[]>(MOCK_ORDERS);
  const [activeTab, setActiveTab] = useState<'skus' | 'orders'>('skus');
  
  // SKU filters & sorting
  const [skuSort, setSkuSort] = useState<'consequence' | 'runway' | 'probability' | 'revenue'>('consequence');
  const [skuSearch, setSkuSearch] = useState('');
  const [selectedSku, setSelectedSku] = useState<SKUExposureItem | null>(MOCK_SKUS[0]);

  // Order filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilterSeverity, setOrderFilterSeverity] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrderExposureItem | null>(null);

  // AI Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    getSKUsExposure().then(setSkus).catch(() => {});
    getOrdersExposure().then(setOrders).catch(() => {});
  }, []);

  const formatRupee = (amt: number) => {
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)} L`;
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  // Filtered and sorted SKUs
  const sortedSkus = useMemo(() => {
    let list = skus.filter(
      (s) =>
        s.id.toLowerCase().includes(skuSearch.toLowerCase()) ||
        s.name.toLowerCase().includes(skuSearch.toLowerCase()) ||
        s.component_name.toLowerCase().includes(skuSearch.toLowerCase())
    );

    if (skuSort === 'runway') {
      list.sort((a, b) => a.runway_days - b.runway_days);
    } else if (skuSort === 'probability') {
      list.sort((a, b) => b.stockout_probability - a.stockout_probability);
    } else if (skuSort === 'revenue') {
      list.sort((a, b) => b.revenue_exposure_inr - a.revenue_exposure_inr);
    } else {
      // Default: operational consequence (P(stockout) * revenue)
      list.sort(
        (a, b) =>
          b.stockout_probability * b.revenue_exposure_inr -
          a.stockout_probability * a.revenue_exposure_inr
      );
    }
    return list;
  }, [skus, skuSearch, skuSort]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchQuery =
        o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(orderSearch.toLowerCase()) ||
        o.sku_id.toLowerCase().includes(orderSearch.toLowerCase());
      const matchSev =
        orderFilterSeverity === 'all' || o.severity.toLowerCase() === orderFilterSeverity.toLowerCase();
      return matchQuery && matchSev;
    });
  }, [orders, orderSearch, orderFilterSeverity]);

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full font-mono">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#143a22] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#00ff88]/20 border border-[#00ff88]/40 px-2 py-0.5 text-[10px] text-[#00ff88]">
              [TRACE + QUANTIFY]
            </span>
            <span className="text-xs text-[#4e6e58]">BILL-OF-MATERIALS & ORDER EXPOSURE</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wide text-white mt-1">
            EXPOSURE CENTER
          </h1>
          <p className="text-xs text-[#87a894] mt-0.5 font-sans">
            Trace predicted chokepoint disruptions through parts, suppliers, SKU runways, and customer order commitments.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-[#143a22] bg-[#07140b] p-1">
          <button
            onClick={() => setActiveTab('skus')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition ${
              activeTab === 'skus'
                ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40'
                : 'text-[#87a894] hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>SKU EXPOSURE ({skus.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition ${
              activeTab === 'orders'
                ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40'
                : 'text-[#87a894] hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>CUSTOMER ORDERS ({orders.length})</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* Tab 1: SKU Exposure Center (Section 19 & 20) */}
      {/* ==================================================================== */}
      {activeTab === 'skus' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Table (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search & Sort Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#07140b] p-3 rounded-lg border border-[#143a22]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#4e6e58]" />
                <input
                  type="text"
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  placeholder="Filter SKUs, parts or components…"
                  className="w-full rounded border border-[#143a22] bg-[#040806] pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#4e6e58] focus:border-[#00ff88] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#4e6e58] text-[10px] uppercase">Sort:</span>
                <select
                  value={skuSort}
                  onChange={(e) => setSkuSort(e.target.value as any)}
                  className="rounded border border-[#143a22] bg-[#040806] px-2 py-1.5 text-xs text-[#00ff88] focus:outline-none"
                >
                  <option value="consequence">Highest Consequence</option>
                  <option value="runway">Soonest Stockout (Runway)</option>
                  <option value="probability">Highest P(Stockout)</option>
                  <option value="revenue">Largest Revenue At Risk</option>
                </select>
              </div>
            </div>

            {/* SKU Table */}
            <div className="rounded-xl border border-[#143a22] bg-[#07140b] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#143a22] bg-[#040806] text-[#4e6e58] text-[10px] uppercase tracking-wider">
                      <th className="p-3">SKU / Product</th>
                      <th className="p-3 text-right">Stock</th>
                      <th className="p-3 text-right">Runway</th>
                      <th className="p-3 text-right">P(Stockout)</th>
                      <th className="p-3 text-right">Orders</th>
                      <th className="p-3 text-right">Exposure</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0e2716]">
                    {sortedSkus.map((sku) => {
                      const isSelected = selectedSku?.id === sku.id;
                      return (
                        <tr
                          key={sku.id}
                          onClick={() => setSelectedSku(sku)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-[#00ff88]/15 border-l-2 border-[#00ff88]'
                              : 'hover:bg-[#00ff88]/5'
                          }`}
                        >
                          <td className="p-3">
                            <div className="font-bold text-white">{sku.id}</div>
                            <div className="text-[10px] text-[#87a894] truncate max-w-[180px]">
                              {sku.name}
                            </div>
                          </td>
                          <td className="p-3 text-right text-[#d1fae5]">
                            {sku.current_stock.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-bold text-red-400">
                            {sku.runway_days.toFixed(1)}d
                          </td>
                          <td className="p-3 text-right">
                            <span
                              className={`font-bold ${
                                sku.stockout_probability > 0.7
                                  ? 'text-red-400'
                                  : sku.stockout_probability > 0.4
                                  ? 'text-amber-400'
                                  : 'text-[#00ff88]'
                              }`}
                            >
                              {Math.round(sku.stockout_probability * 100)}%
                            </span>
                          </td>
                          <td className="p-3 text-right text-[#87a894]">{sku.orders_exposed_count}</td>
                          <td className="p-3 text-right font-bold text-[#00ff88]">
                            {formatRupee(sku.revenue_exposure_inr)}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                sku.severity === 'CRITICAL'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                  : sku.severity === 'HIGH'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                  : 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40'
                              }`}
                            >
                              {sku.severity}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Detail Panel: SKU Profile & Runway (Section 20 & 23 & 24) (5 cols) */}
          <div className="lg:col-span-5">
            {selectedSku ? (
              <div className="rounded-xl border border-[#00ff88]/40 bg-[#07140b] p-5 space-y-5 sticky top-16 shadow-[0_0_20px_rgba(0,255,136,0.1)]">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-[#143a22] pb-3">
                  <div>
                    <span className="text-[10px] text-[#4e6e58] uppercase">SKU DEEP DIVE</span>
                    <h2 className="text-lg font-black text-white mt-0.5">{selectedSku.id}</h2>
                    <span className="text-xs text-[#00ff88]">{selectedSku.name}</span>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      selectedSku.severity === 'CRITICAL'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}
                  >
                    {selectedSku.severity}
                  </span>
                </div>

                {/* Key Metric Blocks */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#040806] p-2.5 rounded border border-[#143a22]">
                    <span className="text-[9px] text-[#4e6e58] uppercase">Current Stock</span>
                    <div className="font-bold text-[#d1fae5] mt-1">{selectedSku.current_stock}</div>
                    <span className="text-[9px] text-[#4e6e58]">Demand: {selectedSku.daily_demand}/d</span>
                  </div>
                  <div className="bg-[#040806] p-2.5 rounded border border-[#143a22]">
                    <span className="text-[9px] text-[#4e6e58] uppercase">Runway</span>
                    <div className="font-bold text-red-400 mt-1">{selectedSku.runway_days.toFixed(1)} Days</div>
                    <span className="text-[9px] text-red-400/80">Gap: {selectedSku.gap_days}d</span>
                  </div>
                  <div className="bg-[#040806] p-2.5 rounded border border-[#143a22]">
                    <span className="text-[9px] text-[#4e6e58] uppercase">P(Stockout)</span>
                    <div className="font-bold text-red-400 mt-1">
                      {Math.round(selectedSku.stockout_probability * 100)}%
                    </div>
                    <span className="text-[9px] text-[#87a894]">{selectedSku.orders_exposed_count} Orders</span>
                  </div>
                </div>

                {/* Supply Chain Causal Path (Section 20) */}
                <div className="space-y-1.5 border-t border-[#143a22] pt-3">
                  <span className="text-[10px] text-[#4e6e58] uppercase tracking-wider">
                    Supply Dependency Trace:
                  </span>
                  <div className="bg-[#040806] p-3 rounded border border-[#143a22] space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      <span className="text-[#87a894]">Disrupted Hub:</span>
                      <strong className="text-white">{selectedSku.transit_hub}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      <span className="text-[#87a894]">Supplier:</span>
                      <strong className="text-white">{selectedSku.supplier_name}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#00ff88]" />
                      <span className="text-[#87a894]">Component:</span>
                      <strong className="text-white">{selectedSku.component_name}</strong>
                    </div>
                  </div>
                </div>

                {/* Visual Inventory Runway Timeline (Section 23) */}
                <div className="space-y-1.5 border-t border-[#143a22] pt-3">
                  <span className="text-[10px] text-[#4e6e58] uppercase tracking-wider">
                    Inventory Runway vs Inbound Arrival:
                  </span>
                  <div className="bg-[#040806] p-3 rounded border border-[#143a22] space-y-2 text-xs">
                    <div className="flex justify-between text-[11px]">
                      <span>Today</span>
                      <span className="text-red-400 font-bold">Stockout: Day 11</span>
                      <span className="text-amber-400">Inbound P50: Day 18</span>
                    </div>

                    {/* Timeline Bar */}
                    <div className="relative h-3 w-full rounded-full bg-[#143a22] overflow-hidden">
                      {/* Current runway (green) */}
                      <div className="absolute top-0 left-0 h-full bg-[#00ff88]" style={{ width: '37%' }} />
                      {/* Critical Stockout Gap (red striped) */}
                      <div className="absolute top-0 left-[37%] h-full bg-red-500/80" style={{ width: '23%' }} />
                    </div>

                    <div className="flex justify-between text-[10px] text-[#87a894]">
                      <span>Current Runway: {selectedSku.runway_days}d</span>
                      <span className="text-red-400 font-bold">Uncovered Gap: {selectedSku.gap_days}d</span>
                    </div>
                  </div>
                </div>

                {/* Probabilistic Stockout Curve (Section 24) */}
                <div className="space-y-1.5 border-t border-[#143a22] pt-3">
                  <span className="text-[10px] text-[#4e6e58] uppercase tracking-wider">
                    Cumulative Stockout Probability:
                  </span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                      <span className="text-[9px] text-[#4e6e58]">&lt; 7 Days</span>
                      <div className="font-bold text-[#00ff88] mt-0.5">
                        {Math.round(selectedSku.prob_stockout_7d * 100)}%
                      </div>
                    </div>
                    <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                      <span className="text-[9px] text-[#4e6e58]">&lt; 14 Days</span>
                      <div className="font-bold text-red-400 mt-0.5">
                        {Math.round(selectedSku.prob_stockout_14d * 100)}%
                      </div>
                    </div>
                    <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                      <span className="text-[9px] text-[#4e6e58]">&lt; 21 Days</span>
                      <div className="font-bold text-red-400 mt-0.5">
                        {Math.round(selectedSku.prob_stockout_21d * 100)}%
                      </div>
                    </div>
                    <div className="bg-[#040806] p-2 rounded border border-[#143a22]">
                      <span className="text-[9px] text-[#4e6e58]">&lt; 30 Days</span>
                      <div className="font-bold text-red-400 mt-0.5">
                        {Math.round(selectedSku.prob_stockout_30d * 100)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mitigation CTA */}
                <div className="border-t border-[#143a22] pt-4">
                  <Link
                    href="/scenarios"
                    className="flex w-full items-center justify-center gap-2 rounded border border-[#00ff88]/50 bg-[#00ff88]/20 py-2.5 text-xs font-bold text-[#00ff88] hover:bg-[#00ff88]/30 transition shadow-[0_0_15px_rgba(0,255,136,0.15)]"
                  >
                    <span>SIMULATE EXPEDITE MITIGATION</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#143a22] bg-[#07140b] p-8 text-center text-xs text-[#87a894]">
                Select an SKU from the table to inspect bill-of-materials and runway.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Tab 2: Customer Order Exposure (Section 21 & 22) */}
      {/* ==================================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Order Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#07140b] p-3 rounded-lg border border-[#143a22]">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#4e6e58]" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Filter by customer, order ID, or SKU…"
                className="w-full rounded border border-[#143a22] bg-[#040806] pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#4e6e58] focus:border-[#00ff88] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#4e6e58] text-[10px] uppercase">Severity:</span>
              <select
                value={orderFilterSeverity}
                onChange={(e) => setOrderFilterSeverity(e.target.value)}
                className="rounded border border-[#143a22] bg-[#040806] px-2.5 py-1.5 text-xs text-[#00ff88] focus:outline-none"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical Only</option>
                <option value="high">High Only</option>
                <option value="medium">Medium Only</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="rounded-xl border border-[#143a22] bg-[#07140b] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#143a22] bg-[#040806] text-[#4e6e58] text-[10px] uppercase tracking-wider">
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Customer Account</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3">Promised Date</th>
                    <th className="p-3">Expected Date</th>
                    <th className="p-3 text-right">Delay</th>
                    <th className="p-3 text-right">Exposure</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0e2716]">
                  {filteredOrders.map((ord) => (
                    <tr
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className="cursor-pointer hover:bg-[#00ff88]/5 transition"
                    >
                      <td className="p-3 font-bold text-white">{ord.id}</td>
                      <td className="p-3 text-[#d1fae5]">{ord.customer_name}</td>
                      <td className="p-3 text-[#87a894] font-bold">{ord.sku_id}</td>
                      <td className="p-3 text-right text-white">{ord.quantity.toLocaleString()}</td>
                      <td className="p-3 text-[#87a894]">{ord.promised_date}</td>
                      <td className="p-3 text-red-400 font-bold">{ord.expected_date}</td>
                      <td className="p-3 text-right text-red-400 font-bold">+{ord.delay_days}d</td>
                      <td className="p-3 text-right text-[#00ff88] font-bold">
                        {formatRupee(ord.revenue_exposure_inr)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="rounded bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[9px] font-bold text-red-400">
                          {ord.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(ord);
                          }}
                          className="rounded border border-[#00ff88]/40 bg-[#00ff88]/10 px-2 py-0.5 text-[10px] text-[#00ff88] hover:bg-[#00ff88]/20"
                        >
                          DETAIL
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal (Section 22) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#00ff88]/50 bg-[#040806] p-6 shadow-[0_0_30px_rgba(0,255,136,0.2)] font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#143a22] pb-3">
              <div>
                <span className="text-[10px] text-[#00ff88] font-bold">[ORDER IMPACT TRACE]</span>
                <h3 className="text-base font-black text-white uppercase mt-0.5">
                  ORDER {selectedOrder.id} · {selectedOrder.customer_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-[#4e6e58] hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#07140b] p-3 rounded border border-[#143a22]">
                <span className="text-[10px] text-[#4e6e58] uppercase">Promised Delivery</span>
                <div className="font-bold text-white mt-0.5">{selectedOrder.promised_date}</div>
              </div>
              <div className="bg-[#07140b] p-3 rounded border border-[#143a22]">
                <span className="text-[10px] text-[#4e6e58] uppercase">Current Expected</span>
                <div className="font-bold text-red-400 mt-0.5">
                  {selectedOrder.expected_date} (+{selectedOrder.delay_days}d)
                </div>
              </div>
            </div>

            <div className="space-y-2 bg-[#07140b] p-3.5 rounded border border-[#143a22] text-xs">
              <div className="flex justify-between">
                <span className="text-[#87a894]">Probability of Missing Date:</span>
                <span className="font-bold text-red-400">{Math.round(selectedOrder.p_miss * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#87a894]">Root Cause:</span>
                <span className="font-bold text-white">{selectedOrder.root_cause}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#87a894]">Affected Component:</span>
                <span className="font-bold text-[#00ff88]">{selectedOrder.affected_component}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#87a894]">Revenue at Risk:</span>
                <span className="font-bold text-[#00ff88]">{formatRupee(selectedOrder.revenue_exposure_inr)}</span>
              </div>
            </div>

            {/* Recommended Action */}
            <div className="rounded border border-[#00ff88]/40 bg-[#00ff88]/10 p-3.5 space-y-1.5">
              <span className="text-[10px] text-[#00ff88] font-bold uppercase">RECOMMENDED INTERVENTION:</span>
              <p className="text-xs text-white">{selectedOrder.recommended_action}</p>
              <div className="flex justify-between text-[11px] text-[#87a894] border-t border-[#143a22] pt-1.5">
                <span>Mitigated ETA: <strong className="text-white">{selectedOrder.expected_mitigated_date}</strong></span>
                <span>P(Miss) falls to: <strong className="text-[#00ff88]">{Math.round(selectedOrder.mitigated_p_miss * 100)}%</strong></span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-3 py-1.5 text-xs text-[#87a894] hover:text-white"
              >
                DISMISS
              </button>
              <Link
                href="/scenarios"
                className="rounded border border-[#00ff88]/50 bg-[#00ff88]/20 px-3 py-1.5 text-xs font-bold text-[#00ff88] hover:bg-[#00ff88]/30 transition"
              >
                SIMULATE INTERVENTION
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Universal AI Analyst */}
      <AIAnalystModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        defaultQuestion={aiPrompt}
      />
    </div>
  );
}
