'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, Package, FileText, AlertCircle } from 'lucide-react';

interface OpenPO {
  po_number: string;
  supplier_name: string | null;
  supplier_code: string | null;
  system_id: string | null;
  expect_date: string | null;
  order_date: string | null;
  po_status: string | null;
  receipt_count: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-500/20 text-blue-300',
  PARTIAL: 'bg-yellow-500/20 text-yellow-300',
  ORDERED: 'bg-cyan-500/20 text-cyan-300',
};

interface Props { isAdmin: boolean; userBranch: string | null; }

export default function OpenPosClient({ isAdmin, userBranch }: Props) {
  const [pos, setPos] = useState<OpenPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState(userBranch ?? '');
  const [q, setQ] = useState('');

  const load = useCallback(async (br: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (br) params.set('branch', br);
      const res = await fetch(`/api/purchasing/pos/open?${params}`);
      if (!res.ok) return;
      setPos(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(branch); }, [load, branch]);

  const filtered = q
    ? pos.filter((p) =>
        p.po_number.toLowerCase().includes(q.toLowerCase()) ||
        (p.supplier_name ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : pos;

  const today = new Date().toISOString().slice(0, 10);
  const overdue = filtered.filter((p) => p.expect_date && p.expect_date < today);
  const upcoming = filtered.filter((p) => !p.expect_date || p.expect_date >= today);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/purchasing" className="text-sm text-cyan-400 hover:underline">&larr; PO Check-In</Link>
          <h1 className="text-2xl font-bold text-white mt-1">Open Purchase Orders</h1>
          <p className="text-sm text-slate-400">{pos.length} open POs{isAdmin ? ' (all branches)' : ''}</p>
        </div>
        <button
          onClick={() => load(branch)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-sm transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter PO# or supplier..."
          className="flex-1 min-w-[200px] bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        {isAdmin && (
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="Branch"
            className="w-28 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        )}
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-red-400">Overdue ({overdue.length})</h2>
          </div>
          <PoTable pos={overdue} isAdmin={isAdmin} rowClass="border-l-2 border-red-500/50" />
        </div>
      )}

      {/* Upcoming / no date */}
      <div>
        {overdue.length > 0 && (
          <h2 className="text-sm font-semibold text-slate-400 mb-2">Upcoming &amp; Unscheduled ({upcoming.length})</h2>
        )}
        <PoTable pos={upcoming} isAdmin={isAdmin} />
      </div>

      {filtered.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
          <Package className="w-10 h-10 opacity-30" />
          <p className="text-sm">{q ? 'No POs match your filter' : 'No open purchase orders'}</p>
        </div>
      )}
    </div>
  );
}

function PoTable({ pos, isAdmin, rowClass = '' }: { pos: OpenPO[]; isAdmin: boolean; rowClass?: string }) {
  if (pos.length === 0) return null;
  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden mb-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">PO #</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Supplier</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Order Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Expect Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Receipts</th>
              {isAdmin && <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Branch</th>}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {pos.map((p) => (
              <tr key={p.po_number} className={`border-b border-white/5 hover:bg-slate-800/50 ${rowClass}`}>
                <td className="px-4 py-3 font-mono text-cyan-400 font-medium">{p.po_number}</td>
                <td className="px-4 py-3 text-slate-200 max-w-[200px] truncate">{p.supplier_name ?? p.supplier_code ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.po_status?.toUpperCase() ?? ''] ?? 'bg-slate-700 text-slate-300'}`}>
                    {p.po_status ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{p.order_date ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300 text-xs">{p.expect_date ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{p.receipt_count ?? 0}</td>
                {isAdmin && <td className="px-4 py-3 text-slate-400 text-xs">{p.system_id ?? '—'}</td>}
                <td className="px-4 py-3">
                  <Link
                    href={`/purchasing/pos/${encodeURIComponent(p.po_number)}`}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
