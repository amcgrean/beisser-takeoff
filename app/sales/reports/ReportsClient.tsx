'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BarChart2, RefreshCw, TrendingUp, Users, Truck } from 'lucide-react';

interface ReportsData {
  period_days: number;
  daily_orders: { order_date: string; count: number }[];
  by_sale_type: { sale_type: string; count: number }[];
  by_ship_via: { ship_via: string; count: number }[];
  top_customers: { cust_name: string | null; order_count: number }[];
  status_breakdown: { so_status: string; cnt: number }[];
}

const PERIOD_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

interface Props {
  isAdmin: boolean;
  userBranch: string | null;
}

function MiniBar({ value, max, color = 'bg-cyan-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{value}</span>
    </div>
  );
}

export default function ReportsClient({ isAdmin, userBranch }: Props) {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(30);
  const [branch, setBranch] = useState(userBranch ?? '');

  const fetch = useCallback(async (p: number, br: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period: String(p) });
      if (br) params.set('branch', br);
      const res = await window.fetch(`/api/sales/reports?${params}`);
      if (!res.ok) return;
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(period, branch); }, [fetch, period, branch]);

  const maxDailyCount = Math.max(...(data?.daily_orders.map((d) => d.count) ?? [1]), 1);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/sales" className="text-sm text-cyan-400 hover:underline">&larr; Sales Hub</Link>
          <h1 className="text-2xl font-bold text-white mt-1">Reports &amp; Analytics</h1>
          <p className="text-sm text-slate-400">Sales performance over time</p>
        </div>
        <div className="flex items-center gap-3">
          {PERIOD_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setPeriod(o.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${period === o.value ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'}`}
            >
              {o.label}
            </button>
          ))}
          {isAdmin && (
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Branch"
              className="w-28 bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          )}
          <button
            onClick={() => fetch(period, branch)}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading analytics...
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily orders chart */}
          <div className="bg-slate-900 border border-white/10 rounded-xl p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Orders by Day</h2>
              <span className="text-xs text-slate-500 ml-auto">Last {period} days</span>
            </div>
            {data.daily_orders.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No data for this period</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {data.daily_orders.map((d) => (
                  <div key={d.order_date} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-24 flex-shrink-0">{d.order_date}</span>
                    <MiniBar value={d.count} max={maxDailyCount} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top customers */}
          <div className="bg-slate-900 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Top Customers</h2>
            </div>
            <div className="space-y-2">
              {data.top_customers.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No data</p>
              ) : data.top_customers.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-200 truncate flex-1">{c.cust_name ?? 'Unknown'}</span>
                  <span className="text-xs text-cyan-400 font-medium">{c.order_count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ship via breakdown */}
          <div className="bg-slate-900 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">By Ship Via</h2>
            </div>
            <div className="space-y-2">
              {data.by_ship_via.map((s, i) => {
                const max = Math.max(...data.by_ship_via.map((x) => x.count), 1);
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">{s.ship_via}</span>
                      <span className="text-xs text-slate-400">{s.count}</span>
                    </div>
                    <MiniBar value={s.count} max={max} color="bg-purple-500" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sale type breakdown */}
          <div className="bg-slate-900 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">By Sale Type</h2>
            </div>
            <div className="space-y-2">
              {data.by_sale_type.map((s, i) => {
                const max = Math.max(...data.by_sale_type.map((x) => x.count), 1);
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">{s.sale_type}</span>
                      <span className="text-xs text-slate-400">{s.count}</span>
                    </div>
                    <MiniBar value={s.count} max={max} color="bg-emerald-500" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status breakdown */}
          <div className="bg-slate-900 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Status Breakdown</h2>
            </div>
            <div className="space-y-2">
              {data.status_breakdown.map((s, i) => {
                const max = Math.max(...data.status_breakdown.map((x) => x.cnt), 1);
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">{s.so_status}</span>
                      <span className="text-xs text-slate-400">{s.cnt}</span>
                    </div>
                    <MiniBar value={s.cnt} max={max} color="bg-cyan-500" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
