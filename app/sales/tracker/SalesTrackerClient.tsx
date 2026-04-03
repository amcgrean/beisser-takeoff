'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { TopNav } from '../../../src/components/nav/TopNav';
import type { DeliveryRecord } from '../../api/delivery/tracker/route';
import { usePageTracking } from '@/hooks/usePageTracking';

interface Props {
  isAdmin: boolean;
  userBranch: string | null;
  userName: string | null;
  userRole?: string;
}

const BRANCHES = ['10FD', '20GR', '25BW', '40CV'];

const STATUS_COLORS: Record<string, string> = {
  'PICKING':              'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  'PARTIAL':              'bg-orange-900/60 text-orange-300 border-orange-700',
  'STAGED':               'bg-purple-900/60 text-purple-300 border-purple-700',
  'STAGED - EN ROUTE':    'bg-indigo-900/60 text-indigo-300 border-indigo-700',
  'STAGED - LOADED':      'bg-blue-900/60 text-blue-300 border-blue-700',
  'STAGED - DELIVERED':   'bg-green-900/60 text-green-300 border-green-700',
  'INVOICED':             'bg-cyan-900/60 text-cyan-300 border-cyan-700',
};

const STATUS_ORDER = [
  'STAGED - EN ROUTE',
  'STAGED - LOADED',
  'STAGED',
  'PARTIAL',
  'PICKING',
  'STAGED - DELIVERED',
  'INVOICED',
];

function statusBadge(label: string) {
  const cls = STATUS_COLORS[label] ?? 'bg-gray-800/80 text-gray-400 border-gray-600';
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls} whitespace-nowrap`}>
      {label}
    </span>
  );
}

export default function SalesTrackerClient({ isAdmin, userBranch, userName, userRole }: Props) {
  usePageTracking();
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [branch, setBranch] = useState(isAdmin ? '' : (userBranch ?? ''));
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ date });
      if (branch) params.set('branch', branch);
      const res = await fetch(`/api/delivery/tracker?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json() as { deliveries: DeliveryRecord[] };
      setDeliveries(data.deliveries);
      setLastRefresh(new Date());
    } catch {
      setError('Failed to load deliveries.');
    } finally {
      setLoading(false);
    }
  }, [date, branch]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s when visible
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => deliveries.filter((d) => {
    if (statusFilter && d.status_label !== statusFilter) return false;
    if (!q) return true;
    const ql = q.toLowerCase();
    return (
      d.so_number.toLowerCase().includes(ql) ||
      d.customer_name.toLowerCase().includes(ql) ||
      (d.reference ?? '').toLowerCase().includes(ql) ||
      (d.city ?? '').toLowerCase().includes(ql) ||
      (d.address ?? '').toLowerCase().includes(ql)
    );
  }), [deliveries, q, statusFilter]);

  const statusCounts = useMemo(() => deliveries.reduce<Record<string, number>>((acc, d) => {
    acc[d.status_label] = (acc[d.status_label] ?? 0) + 1;
    return acc;
  }, {}), [deliveries]);

  const kpi = useMemo(() => ({
    total: deliveries.length,
    inTransit: deliveries.filter((d) => d.status_label === 'STAGED - EN ROUTE' || d.status_label === 'STAGED - LOADED').length,
    delivered: deliveries.filter((d) => d.status_label === 'STAGED - DELIVERED' || d.status_label === 'INVOICED').length,
    pending: deliveries.filter((d) => ['PICKING', 'PARTIAL', 'STAGED'].includes(d.status_label)).length,
  }), [deliveries]);

  const sortedStatuses = useMemo(() =>
    STATUS_ORDER.filter((s) => statusCounts[s] != null),
    [statusCounts]
  );

  return (
    <>
    <TopNav userName={userName} userRole={userRole} />
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400">Sales Delivery Tracker</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Today&apos;s deliveries for {branch || 'all branches'}
              {lastRefresh && (
                <span className="ml-2 text-gray-600">
                  — updated {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {isAdmin && (
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
              >
                <option value="">All Branches</option>
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            />
            <button
              onClick={load}
              disabled={loading}
              className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm rounded transition"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Orders', value: kpi.total, color: 'text-white' },
            { label: 'In Transit', value: kpi.inTransit, color: 'text-indigo-300' },
            { label: 'Delivered', value: kpi.delivered, color: 'text-green-300' },
            { label: 'Pending', value: kpi.pending, color: 'text-yellow-300' },
          ].map((card) => (
            <div key={card.label} className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3">
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Status filter chips */}
        {deliveries.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setStatusFilter('')}
              className={`text-xs px-2 py-1 rounded border transition ${
                !statusFilter
                  ? 'bg-gray-700 border-gray-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              All
            </button>
            {sortedStatuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
                className={`flex items-center gap-1 transition ${s === statusFilter ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
              >
                {statusBadge(s)}
                <span className="text-xs text-gray-300 font-semibold">{statusCounts[s]}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}</div>
        )}

        {/* Search */}
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by SO #, customer, city, address, or reference…"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />

        {/* Deliveries table */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-700 text-sm text-gray-400">
            {loading && deliveries.length === 0
              ? 'Loading…'
              : `${filtered.length} of ${deliveries.length} orders`}
          </div>
          {filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-700">
                    <th className="px-4 py-2 text-left font-medium">Customer</th>
                    <th className="px-4 py-2 text-left font-medium">SO #</th>
                    <th className="px-4 py-2 text-left font-medium">Reference</th>
                    <th className="px-4 py-2 text-left font-medium">Deliver To</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Expected</th>
                    <th className="px-4 py-2 text-left font-medium">Driver</th>
                    {isAdmin && <th className="px-4 py-2 text-left font-medium">Branch</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={`${d.system_id}|${d.so_number}`} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-2.5 max-w-[200px]">
                        <Link
                          href={`/sales/orders/${d.so_number}`}
                          className="font-medium text-gray-100 hover:text-cyan-400 transition-colors truncate block"
                        >
                          {d.customer_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-cyan-300 whitespace-nowrap">
                        <Link href={`/sales/orders/${d.so_number}`} className="hover:underline">
                          {d.so_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[140px] truncate">
                        {d.reference || '—'}
                      </td>
                      <td className="px-4 py-2.5 max-w-[200px]">
                        {d.address ? (
                          <>
                            <div className="text-xs text-gray-300 truncate">{d.address}</div>
                            {d.city && <div className="text-xs text-gray-500 truncate">{d.city}</div>}
                          </>
                        ) : (
                          <span className="text-xs text-gray-600">{d.city || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">{statusBadge(d.status_label)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                        {d.expect_date
                          ? new Date(d.expect_date + 'T00:00:00').toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">
                        {d.driver || d.ship_via || '—'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2.5 text-xs text-gray-500">{d.system_id}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              {loading ? 'Loading…' : 'No deliveries found for this date.'}
            </div>
          )}
        </div>

      </div>
    </div>
    </>
  );
}
