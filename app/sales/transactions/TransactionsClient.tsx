'use client';

import React, { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Search, RefreshCw, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

interface Order {
  so_number: string;
  system_id: string;
  customer_name: string | null;
  customer_code: string | null;
  reference: string | null;
  so_status: string;
  sale_type: string | null;
  ship_via: string | null;
  salesperson: string | null;
  po_number: string | null;
  expect_date: string | null;
  line_count: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'O', label: 'Open' },
  { value: 'K', label: 'Picking' },
  { value: 'P', label: 'Partial' },
  { value: 'S', label: 'Staged' },
  { value: 'I', label: 'Invoiced' },
  { value: 'C', label: 'Closed' },
];

const STATUS_COLORS: Record<string, string> = {
  O: 'bg-blue-500/20 text-blue-300',
  K: 'bg-yellow-500/20 text-yellow-300',
  P: 'bg-orange-500/20 text-orange-300',
  S: 'bg-purple-500/20 text-purple-300',
  I: 'bg-green-500/20 text-green-300',
  C: 'bg-slate-500/20 text-slate-400',
};

interface Props {
  isAdmin: boolean;
  userBranch: string | null;
}

export default function TransactionsClient({ isAdmin, userBranch }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('O');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [saleType, setSaleType] = useState('');
  const [branch, setBranch] = useState(userBranch ?? '');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOrders = useCallback(async (opts: {
    q: string; status: string; dateFrom: string; dateTo: string;
    saleType: string; branch: string; page: number;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts.q) params.set('q', opts.q);
      if (opts.status) params.set('status', opts.status);
      if (opts.dateFrom) params.set('date_from', opts.dateFrom);
      if (opts.dateTo) params.set('date_to', opts.dateTo);
      if (opts.saleType) params.set('sale_type', opts.saleType);
      if (opts.branch) params.set('branch', opts.branch);
      params.set('limit', '50');
      params.set('page', String(opts.page));
      const res = await fetch(`/api/sales/orders?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (opts.page === 1) {
        setOrders(data.orders ?? []);
      } else {
        setOrders((prev) => [...prev, ...(data.orders ?? [])]);
      }
      setHasMore((data.orders ?? []).length === 50);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerSearch = useCallback((overrides: Record<string, string> = {}, newPage = 1) => {
    const opts = { q, status, dateFrom, dateTo, saleType, branch, ...overrides };
    setPage(newPage);
    fetchOrders({ ...opts, page: newPage });
  }, [q, status, dateFrom, dateTo, saleType, branch, fetchOrders]);

  const handleQChange = (v: string) => {
    setQ(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => triggerSearch({ q: v }), 400);
  };

  React.useEffect(() => {
    triggerSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchOrders({ q, status, dateFrom, dateTo, saleType, branch, page: next });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/sales" className="text-sm text-cyan-400 hover:underline">&larr; Sales Hub</Link>
          <h1 className="text-2xl font-bold text-white mt-1">Sales Transactions</h1>
          <p className="text-sm text-slate-400">Search and act on all sales orders</p>
        </div>
        <button
          onClick={() => triggerSearch()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-sm transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => handleQChange(e.target.value)}
              placeholder="SO#, customer, reference, PO#..."
              className="w-full bg-slate-800 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); triggerSearch({ status: e.target.value }); }}
            className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {isAdmin && (
            <input
              value={branch}
              onChange={(e) => { setBranch(e.target.value); triggerSearch({ branch: e.target.value }); }}
              placeholder="Branch (e.g. 20GR)"
              className="w-28 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); triggerSearch({ dateFrom: e.target.value }); }}
              className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); triggerSearch({ dateTo: e.target.value }); }}
              className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <input
            value={saleType}
            onChange={(e) => { setSaleType(e.target.value); triggerSearch({ saleType: e.target.value }); }}
            placeholder="Sale type..."
            className="w-36 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => triggerSearch()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition"
          >
            Search
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm text-slate-400">{orders.length} orders shown</span>
          {loading && <span className="text-xs text-cyan-400 animate-pulse">Loading...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">SO #</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Reference</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Expect Date</th>
                {isAdmin && <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Branch</th>}
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Lines</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && !loading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-10 text-center text-slate-500">
                    No orders found. Adjust filters and search.
                  </td>
                </tr>
              ) : orders.map((o) => (
                <tr key={`${o.so_number}-${o.system_id}`} className="border-b border-white/5 hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-mono text-cyan-400 font-medium">{o.so_number}</td>
                  <td className="px-4 py-3">
                    {o.customer_code ? (
                      <Link
                        href={`/sales/customers/${encodeURIComponent(o.customer_code.trim())}`}
                        className="text-white hover:text-cyan-400 transition flex items-center gap-1"
                      >
                        {o.customer_name ?? o.customer_code}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </Link>
                    ) : (
                      <span className="text-slate-300">{o.customer_name ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-[160px] truncate">{o.reference ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[o.so_status?.toUpperCase()] ?? 'bg-slate-700 text-slate-300'}`}>
                      {o.so_status?.toUpperCase() ?? '?'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{o.sale_type ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{o.expect_date ?? '—'}</td>
                  {isAdmin && <td className="px-4 py-3 text-slate-400 text-xs">{o.system_id}</td>}
                  <td className="px-4 py-3 text-slate-400">{o.line_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="px-4 py-3 border-t border-white/10 text-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
