'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopNav } from '../../../src/components/nav/TopNav';
import type { DeliveryReportPayload, DeliveryReportRow } from '../../api/ops/delivery-reporting/route';
import { usePageTracking } from '@/hooks/usePageTracking';

interface Props {
  isAdmin: boolean;
  userBranch: string | null;
  userName: string | null;
  userRole?: string;
}

const WINDOWS = ['7d', '30d', '90d'] as const;
const BRANCHES = ['10FD', '20GR', '25BW', '40CV'];

function exportCsv(detail: DeliveryReportRow[], filename: string) {
  const headers = ['ship_date', 'branch', 'so_number', 'sale_type', 'ship_via', 'line_count'];
  const rows = detail.map((r) => [r.ship_date, r.system_id, r.so_id, r.sale_type ?? '', r.ship_via ?? '', r.line_count].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DeliveryReportingClient({ isAdmin, userBranch, userName, userRole }: Props) {
  usePageTracking();
  const [windowParam, setWindowParam] = useState<'7d' | '30d' | '90d'>('30d');
  const [saleType, setSaleType] = useState('all');
  const [branch, setBranch] = useState(isAdmin ? '' : (userBranch ?? ''));
  const [data, setData] = useState<DeliveryReportPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ window: windowParam, sale_type: saleType, detail_limit: '500' });
      if (branch) params.set('branch', branch);
      const res = await fetch(`/api/ops/delivery-reporting?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      setData(await res.json() as DeliveryReportPayload);
    } catch {
      setError('Failed to load delivery report.');
    } finally {
      setLoading(false);
    }
  }, [windowParam, saleType, branch]);

  useEffect(() => { load(); }, [load]);

  const avgPerDay = data && data.by_date.length > 0
    ? (data.total / data.by_date.length).toFixed(1)
    : '—';

  const maxCount = data ? Math.max(...data.by_date.map((r) => r.count), 1) : 1;

  return (
    <>
    <TopNav userName={userName} userRole={userRole} />
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h1 className="text-2xl font-bold text-cyan-400">Delivery Reporting</h1>
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
            <select
              value={saleType}
              onChange={(e) => setSaleType(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            >
              <option value="all">All Types</option>
              {data?.by_sale_type.map((s) => (
                <option key={s.sale_type} value={s.sale_type}>{s.sale_type}</option>
              ))}
            </select>
            <div className="flex gap-1">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWindowParam(w)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    windowParam === w ? 'bg-cyan-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
            {data && (
              <button
                onClick={() => exportCsv(data.detail, `delivery-report-${windowParam}-${saleType}.csv`)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition"
              >
                Export CSV
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}</div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-500 font-semibold tracking-widest mb-1">TOTAL DELIVERIES</div>
            <div className="text-3xl font-bold text-cyan-300">{loading ? '…' : (data?.total ?? '—')}</div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-500 font-semibold tracking-widest mb-1">AVG / DAY</div>
            <div className="text-3xl font-bold text-yellow-400">{loading ? '…' : avgPerDay}</div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 col-span-2">
            <div className="text-xs text-gray-500 font-semibold tracking-widest mb-2">BY SALE TYPE</div>
            <div className="flex flex-wrap gap-2">
              {data?.by_sale_type.map((s) => (
                <span key={s.sale_type} className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-gray-300">
                  {s.sale_type}: <span className="text-cyan-300 font-semibold">{s.count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* By date mini chart */}
        {data && data.by_date.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 text-sm font-semibold text-gray-300">
              Deliveries by Date
            </div>
            <div className="p-4 space-y-1 max-h-64 overflow-y-auto">
              {data.by_date.map((r) => (
                <div key={r.date} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400 w-24 flex-shrink-0">{r.date}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 bg-cyan-600 rounded-full"
                      style={{ width: `${(r.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-cyan-300 font-semibold w-8 text-right">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ship via breakdown */}
        {data && data.by_ship_via.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 text-sm font-semibold text-gray-300">
              By Ship Via
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {data.by_ship_via.map((s) => (
                <span key={s.ship_via} className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-300">
                  {s.ship_via}: <span className="text-cyan-300 font-semibold">{s.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Detail table */}
        {data && data.detail.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-700 text-sm text-gray-400">
              {data.detail.length} detail rows
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-900">
                  <tr className="text-xs text-gray-500 border-b border-gray-700">
                    <th className="px-4 py-2 text-left font-medium">Ship Date</th>
                    {isAdmin && <th className="px-4 py-2 text-left font-medium">Branch</th>}
                    <th className="px-4 py-2 text-left font-medium">SO #</th>
                    <th className="px-4 py-2 text-left font-medium">Sale Type</th>
                    <th className="px-4 py-2 text-left font-medium">Ship Via</th>
                    <th className="px-4 py-2 text-right font-medium">Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {data.detail.map((r, i) => (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/40">
                      <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">{r.ship_date}</td>
                      {isAdmin && <td className="px-4 py-2 text-gray-500 text-xs">{r.system_id}</td>}
                      <td className="px-4 py-2 font-mono text-cyan-300 text-xs">{r.so_id}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{r.sale_type ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{r.ship_via ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-300 text-xs font-mono">{r.line_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && data && data.detail.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-8">No delivery data found for this period.</div>
        )}

      </div>
    </div>
    </>
  );
}
