'use client';

import React, { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Search, RefreshCw, ExternalLink } from 'lucide-react';

interface HistoryOrder {
  so_number: string;
  system_id: string;
  so_status: string;
  sale_type: string | null;
  ship_via: string | null;
  salesperson: string | null;
  expect_date: string | null;
  invoice_date: string | null;
  reference: string | null;
  po_number: string | null;
  customer_name: string | null;
  customer_code: string | null;
  line_count: number;
}

interface Props {
  isAdmin: boolean;
  userBranch: string | null;
}

export default function HistoryClient({ isAdmin, userBranch }: Props) {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);

  const [q, setQ] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branch, setBranch] = useState(userBranch ?? '');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = useCallback(async (opts: {
    q: string; customerNumber: string; dateFrom: string;
    dateTo: string; branch: string; page: number;
  }) => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (opts.q) params.set('q', opts.q);
      if (opts.customerNumber) params.set('customer_number', opts.customerNumber);
      if (opts.dateFrom) params.set('date_from', opts.dateFrom);
      if (opts.dateTo) params.set('date_to', opts.dateTo);
      if (opts.branch) params.set('branch', opts.branch);
      params.set('limit', '50');
      params.set('page', String(opts.page));
      const res = await fetch(`/api/sales/history?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (opts.page === 1) {
        setOrders(data.history ?? []);
      } else {
        setOrders((prev) => [...prev, ...(data.history ?? [])]);
      }
      setHasMore((data.history ?? []).length === 50);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerSearch = useCallback((overrides: Record<string, string> = {}, newPage = 1) => {
    const opts = { q, customerNumber, dateFrom, dateTo, branch, ...overrides };
    setPage(newPage);
    fetchHistory({ ...opts, page: newPage });
  }, [q, customerNumber, dateFrom, dateTo, branch, fetchHistory]);

  const handleQChange = (v: string) => {
    setQ(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.length >= 2 || v.length === 0) {
      debounceRef.current = setTimeout(() => triggerSearch({ q: v }), 500);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/sales" className="text-sm text-cyan-400 hover:underline">&larr; Sales Hub</Link>
          <h1 className="text-2xl font-bold text-white mt-1">Purchase History</h1>
          <p className="text-sm text-slate-400">Search invoiced and closed orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => handleQChange(e.target.value)}
              placeholder="SO#, customer, reference..."
              className="w-full bg-slate-800 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <input
            value={customerNumber}
            onChange={(e) => setCustomerNumber(e.target.value)}
            placeholder="Customer # (exact)"
            className="w-44 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {isAdmin && (
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Branch"
              className="w-28 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Invoice from</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">to</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
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
          <span className="text-sm text-slate-400">{searched ? `${orders.length} records` : 'Enter search criteria above'}</span>
          {loading && <span className="text-xs text-cyan-400 animate-pulse">Loading...</span>}
        </div>
        {!searched ? (
          <div className="px-4 py-12 text-center text-slate-500">
            Use the filters above to search purchase history
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">SO #</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Reference</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Invoice Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  {isAdmin && <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Branch</th>}
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Lines</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="px-4 py-10 text-center text-slate-500">
                      No history found for these criteria.
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
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${o.so_status?.toUpperCase() === 'I' ? 'bg-green-500/20 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                        {o.so_status?.toUpperCase() ?? '?'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{o.invoice_date ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{o.sale_type ?? '—'}</td>
                    {isAdmin && <td className="px-4 py-3 text-slate-400 text-xs">{o.system_id}</td>}
                    <td className="px-4 py-3 text-slate-400">{o.line_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && (
          <div className="px-4 py-3 border-t border-white/10 text-center">
            <button
              onClick={() => { const next = page + 1; setPage(next); fetchHistory({ q, customerNumber, dateFrom, dateTo, branch, page: next }); }}
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
