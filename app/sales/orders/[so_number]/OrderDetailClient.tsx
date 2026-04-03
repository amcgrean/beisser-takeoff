'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
interface OrderLine {
  sequence: number;
  item: string | null;
  description: string | null;
  size: string | null;
  qty_ordered: number | null;
  bo: number | null;
  price: number | null;
  uom: string | null;
}

interface OrderDetail {
  so_number: string;
  system_id: string;
  so_status: string;
  sale_type: string | null;
  customer_name: string | null;
  customer_code: string | null;
  reference: string | null;
  po_number: string | null;
  expect_date: string | null;
  created_date: string | null;
  invoice_date: string | null;
  ship_date: string | null;
  promise_date: string | null;
  ship_via: string | null;
  terms: string | null;
  salesperson: string | null;
  branch_code: string | null;
  lines: OrderLine[];
}

const SO_STATUS: Record<string, { label: string; color: string }> = {
  O: { label: 'Open',      color: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  K: { label: 'Picking',   color: 'bg-yellow-900/60 text-yellow-300 border-yellow-700' },
  S: { label: 'Staged',    color: 'bg-orange-900/60 text-orange-300 border-orange-700' },
  D: { label: 'Delivered', color: 'bg-cyan-900/60 text-cyan-300 border-cyan-700' },
  I: { label: 'Invoiced',  color: 'bg-green-900/60 text-green-300 border-green-700' },
  C: { label: 'Closed',    color: 'bg-gray-800/80 text-gray-400 border-gray-600' },
  P: { label: 'Picked',    color: 'bg-indigo-900/60 text-indigo-300 border-indigo-700' },
};

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function money(val: number | null | undefined) {
  if (val == null) return '—';
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  soNumber: string;
}

export default function OrderDetailClient({ soNumber }: Props) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sales/orders/${encodeURIComponent(soNumber)}`);
      if (res.status === 404) { setError('Order not found.'); return; }
      if (!res.ok) throw new Error('Failed to load');
      setOrder(await res.json() as OrderDetail);
    } catch {
      setError('Failed to load order.');
    } finally {
      setLoading(false);
    }
  }, [soNumber]);

  useEffect(() => { load(); }, [load]);

  const statusInfo = order
    ? (SO_STATUS[order.so_status?.toUpperCase()] ?? { label: order.so_status || '—', color: 'bg-gray-800/80 text-gray-400 border-gray-600' })
    : null;

  // Compute line totals
  const lineTotal = order?.lines.reduce((sum, l) => {
    if (l.price != null && l.qty_ordered != null) return sum + l.price * l.qty_ordered;
    return sum;
  }, 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Back link */}
        <Link href="/sales" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={14} />
          Sales Hub
        </Link>

        {loading && (
          <div className="text-gray-500 text-sm py-12 text-center">Loading…</div>
        )}
        {error && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>
        )}

        {order && (
          <>
            {/* Header card */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap gap-3 items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold font-mono text-cyan-400">{order.so_number}</h1>
                    {statusInfo && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    )}
                  </div>
                  {order.customer_code ? (
                    <Link
                      href={`/sales/customers/${order.customer_code}`}
                      className="text-lg text-gray-200 hover:text-cyan-400 transition-colors mt-0.5 block"
                    >
                      {order.customer_name ?? order.customer_code}
                    </Link>
                  ) : (
                    <div className="text-lg text-gray-200 mt-0.5">{order.customer_name ?? '—'}</div>
                  )}
                </div>
                <div className="text-right text-sm text-gray-400">
                  <div>{order.system_id}</div>
                  {order.salesperson && <div>{order.salesperson}</div>}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm border-t border-gray-700 pt-4">
                <div>
                  <div className="text-xs text-gray-500 font-semibold tracking-wide">CREATED</div>
                  <div className="text-gray-200">{fmt(order.created_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold tracking-wide">EXPECT</div>
                  <div className="text-gray-200">{fmt(order.expect_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold tracking-wide">PROMISED</div>
                  <div className="text-gray-200">{fmt(order.promise_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold tracking-wide">SHIPPED</div>
                  <div className="text-gray-200">{fmt(order.ship_date)}</div>
                </div>
                {order.invoice_date && (
                  <div>
                    <div className="text-xs text-gray-500 font-semibold tracking-wide">INVOICED</div>
                    <div className="text-gray-200">{fmt(order.invoice_date)}</div>
                  </div>
                )}
                {order.po_number && (
                  <div>
                    <div className="text-xs text-gray-500 font-semibold tracking-wide">PO #</div>
                    <div className="text-gray-200">{order.po_number}</div>
                  </div>
                )}
                {order.reference && (
                  <div>
                    <div className="text-xs text-gray-500 font-semibold tracking-wide">REFERENCE</div>
                    <div className="text-gray-200">{order.reference}</div>
                  </div>
                )}
                {order.ship_via && (
                  <div>
                    <div className="text-xs text-gray-500 font-semibold tracking-wide">SHIP VIA</div>
                    <div className="text-gray-200">{order.ship_via}</div>
                  </div>
                )}
                {order.sale_type && (
                  <div>
                    <div className="text-xs text-gray-500 font-semibold tracking-wide">SALE TYPE</div>
                    <div className="text-gray-200">{order.sale_type}</div>
                  </div>
                )}
                {order.terms && (
                  <div>
                    <div className="text-xs text-gray-500 font-semibold tracking-wide">TERMS</div>
                    <div className="text-gray-200">{order.terms}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Line items */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-300">
                  Line Items ({order.lines.length})
                </span>
                {lineTotal > 0 && (
                  <span className="text-sm text-gray-400">
                    Est. Total: <span className="text-cyan-300 font-semibold">${money(lineTotal)}</span>
                  </span>
                )}
              </div>

              {order.lines.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">No line items found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-700">
                        <th className="px-4 py-2 text-left font-medium w-10">#</th>
                        <th className="px-4 py-2 text-left font-medium">Item</th>
                        <th className="px-4 py-2 text-left font-medium">Description</th>
                        <th className="px-4 py-2 text-left font-medium">Size</th>
                        <th className="px-4 py-2 text-right font-medium">Ordered</th>
                        <th className="px-4 py-2 text-right font-medium">B/O</th>
                        <th className="px-4 py-2 text-right font-medium">Price</th>
                        <th className="px-4 py-2 text-left font-medium">UOM</th>
                        <th className="px-4 py-2 text-right font-medium">Ext.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lines.map((line) => {
                        const ext = line.price != null && line.qty_ordered != null
                          ? line.price * line.qty_ordered
                          : null;
                        return (
                          <tr key={line.sequence} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-gray-500">{line.sequence}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-cyan-300 whitespace-nowrap">
                              {line.item ?? '—'}
                            </td>
                            <td className="px-4 py-2.5 text-gray-200 max-w-[260px]">
                              <div className="truncate">{line.description ?? '—'}</div>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                              {line.size ?? '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-200">
                              {line.qty_ordered != null ? line.qty_ordered.toLocaleString() : '—'}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-mono text-xs ${line.bo ? 'text-red-400' : 'text-gray-600'}`}>
                              {line.bo != null && line.bo !== 0 ? line.bo.toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-300">
                              {line.price != null ? `$${money(line.price)}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{line.uom ?? '—'}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-200">
                              {ext != null ? `$${money(ext)}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {lineTotal > 0 && (
                      <tfoot>
                        <tr className="border-t border-gray-700 bg-gray-800/40">
                          <td colSpan={8} className="px-4 py-2.5 text-xs text-gray-400 text-right font-semibold">
                            ESTIMATED TOTAL
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-sm text-cyan-300 font-semibold">
                            ${money(lineTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
