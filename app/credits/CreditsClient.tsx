'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, FileText, ChevronLeft, ChevronRight, Loader2, Paperclip,
} from 'lucide-react';
import { usePageTracking } from '@/hooks/usePageTracking';

type CmRow = {
  so_id: string;
  cust_name: string | null;
  cust_code: string | null;
  so_status: string | null;
  system_id: string | null;
  doc_count: string;
  latest_doc_received: string | null;
};

type ListResponse = {
  mode: 'list'; rows: CmRow[];
  total: number; page: number; totalPages: number; branch: string;
};
type SearchResponse = { mode: 'search'; rows: CmRow[]; total: number };

function fmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { dateStyle: 'short' });
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? '').toUpperCase();
  const cls = s === 'O'
    ? 'bg-cyan-900/40 text-cyan-300 border-cyan-700/50'
    : s === 'S'
    ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50'
    : 'bg-gray-800 text-gray-400 border-gray-700';
  const label = s === 'O' ? 'Open' : s === 'S' ? 'Staged' : (s || '—');
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cls}`}>{label}</span>
  );
}

export default function CreditsClient() {
  usePageTracking();

  const [q, setQ]               = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [rows, setRows]         = useState<CmRow[]>([]);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]       = useState(0);
  const [mode, setMode]         = useState<'list' | 'search'>('list');

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/credits?page=${p}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as ListResponse;
      setRows(data.rows);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      setMode('list');
    } catch {
      setError('Could not load credits.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPage(1); }, [loadPage]);

  async function search(query: string) {
    if (!query.trim()) { loadPage(1); return; }
    setLoading(true);
    setError('');
    try {
      const isRma = /^\d+/.test(query) || /^rma/i.test(query) || /^cm/i.test(query);
      const sp = new URLSearchParams();
      if (isRma) sp.set('rma', query.replace(/^(rma|cm)[#\s]*/i, '').trim());
      else        sp.set('q', query);
      const res = await fetch(`/api/credits?${sp}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as SearchResponse;
      setRows(data.rows);
      setTotal(data.total);
      setMode('search');
    } catch {
      setError('Search unavailable.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) { e.preventDefault(); search(q); }
  function clearSearch() { setQ(''); loadPage(1); }

  const docCount = (row: CmRow) => parseInt(row.doc_count, 10);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-cyan-400">RMA Credits</h1>
        <p className="text-sm text-gray-500 mt-1">
          Open credit memos from ERP — not yet invoiced, filtered by your branch.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); if (!e.target.value) clearSearch(); }}
            placeholder="CM number or customer name…"
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading || q.length < 2}
          className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
        >
          {loading && mode === 'search' ? 'Searching…' : 'Search'}
        </button>
        {mode === 'search' && (
          <button
            type="button"
            onClick={clearSearch}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">
          {loading ? 'Loading…' : `${total} open credit memo${total !== 1 ? 's' : ''}`}
          {mode === 'search' && !loading && ` matching "${q}"`}
        </p>
        {!loading && mode === 'list' && totalPages > 1 && (
          <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">CM #</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Branch</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Docs</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Last Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-500" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                  No open credit memos found.
                </td>
              </tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.so_id} className="hover:bg-gray-900/50 transition-colors">
                <td className="px-4 py-3 font-mono text-cyan-400 font-medium whitespace-nowrap">
                  {row.so_id}
                </td>
                <td className="px-4 py-3 max-w-[220px]">
                  <div className="truncate text-gray-200">{row.cust_name ?? '—'}</div>
                  {row.cust_code && (
                    <div className="text-xs text-gray-500">{row.cust_code}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.so_status} />
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-400">
                  {row.system_id ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {docCount(row) > 0 ? (
                    <div className="flex items-center gap-1.5 text-cyan-400">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="text-sm font-medium">{row.doc_count}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      None
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                  {fmt(row.latest_doc_received)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && mode === 'list' && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => loadPage(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => loadPage(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
