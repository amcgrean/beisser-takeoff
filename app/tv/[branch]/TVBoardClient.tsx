'use client';

import { useState, useEffect, useCallback } from 'react';

const REFRESH_INTERVAL = 30_000; // 30s

interface PickItem {
  so_number: string;
  customer_name: string;
  reference: string | null;
  so_status: string | null;
  expect_date: string | null;
  sale_type: string | null;
  handling_code: string;
  line_count: number;
  pick_printed_date: string | null;
  assigned_picker: { picker_id: number; picker_name: string } | null;
}

const STATUS_LABEL: Record<string, string> = { K: 'Pick', P: 'Pick/Pack', S: 'Ship' };
const HC_COLORS: Record<string, string> = {
  DECKING:  'text-yellow-400',
  'DECK BLDG': 'text-yellow-400',
  EWP:      'text-purple-400',
  MILLWORK: 'text-orange-400',
  'DOOR 1': 'text-blue-400',
  DOOR1:    'text-blue-400',
  METALS:   'text-gray-400',
  UNROUTED: 'text-red-400',
};

function hcColor(hc: string) {
  return HC_COLORS[hc.toUpperCase()] ?? 'text-cyan-400';
}

function formatTime(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return null; }
}

export default function TVBoardClient({
  branch,
  handlingCode,
}: {
  branch: string;
  handlingCode: string | null;
}) {
  const [items, setItems] = useState<PickItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ branch });
      if (handlingCode) params.set('handling_code', handlingCode);
      const res = await fetch(`/api/tv/picks?${params}`);
      if (res.ok) {
        const data = await res.json() as { items: PickItem[] };
        setItems(data.items ?? []);
        setLastRefresh(new Date());
        setError(null);
      } else {
        setError('Failed to load');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [branch, handlingCode]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  const title = handlingCode
    ? `${handlingCode} Board — ${branch}`
    : `Picks Board — ${branch}`;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col text-sm">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="text-2xl font-bold text-cyan-400 tracking-wide">{title}</div>
        <div className="text-xs text-gray-500">
          {loading && 'Loading…'}
          {!loading && lastRefresh && `Updated ${formatTime(lastRefresh.toISOString())}`}
          {error && <span className="text-red-400 ml-2">{error}</span>}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading && items.length === 0 ? (
          <div className="p-10 text-center text-gray-600 text-lg">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-gray-600 text-lg">No open orders.</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-semibold">SO #</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-left font-semibold">Ref</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">HC</th>
                <th className="px-4 py-3 text-right font-semibold">Lines</th>
                <th className="px-4 py-3 text-left font-semibold">Need By</th>
                <th className="px-4 py-3 text-left font-semibold">Ticket</th>
                <th className="px-4 py-3 text-left font-semibold">Picker</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.so_number}
                  className={`border-b border-gray-800 ${idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/40'}`}
                >
                  <td className="px-4 py-3 font-mono font-semibold text-white text-base">
                    {item.so_number}
                  </td>
                  <td className="px-4 py-3 text-gray-200 max-w-[200px] truncate">
                    {item.customer_name}
                  </td>
                  <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate">
                    {item.reference ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-800 rounded text-gray-300 text-xs">
                      {STATUS_LABEL[item.so_status ?? ''] ?? item.so_status ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {item.sale_type ?? '—'}
                  </td>
                  <td className={`px-4 py-3 font-semibold text-xs ${hcColor(item.handling_code)}`}>
                    {item.handling_code}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {item.line_count}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatDate(item.expect_date) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {item.pick_printed_date ? formatTime(item.pick_printed_date) : <span className="text-red-500">Not printed</span>}
                  </td>
                  <td className="px-4 py-3">
                    {item.assigned_picker ? (
                      <span className="text-cyan-400 font-semibold">
                        {item.assigned_picker.picker_name}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-900 border-t border-gray-700 px-6 py-2 flex items-center justify-between text-xs text-gray-600">
        <div>{items.length} order{items.length !== 1 ? 's' : ''}</div>
        <div>Refreshes every 30s</div>
      </div>
    </div>
  );
}
