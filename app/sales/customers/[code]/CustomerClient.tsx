'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, MapPin, Phone, RefreshCw, ShoppingCart, History } from 'lucide-react';
import { usePageTracking } from '@/hooks/usePageTracking';

interface Customer {
  cust_key: string;
  cust_name: string | null;
  address_1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
}

interface Order {
  so_number: string;
  system_id: string;
  so_status: string;
  sale_type: string | null;
  ship_via: string | null;
  expect_date: string | null;
  invoice_date: string | null;
  reference: string | null;
}

interface ShipTo {
  shipto_seq: string;
  shipto_name: string | null;
  address_1: string | null;
  city: string | null;
  state: string | null;
}

interface ProfileData {
  customer: Customer;
  open_orders: Order[];
  history: Order[];
  ship_to: ShipTo[];
  open_count: number;
  total_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  O: 'bg-blue-500/20 text-blue-300',
  K: 'bg-yellow-500/20 text-yellow-300',
  P: 'bg-orange-500/20 text-orange-300',
  S: 'bg-purple-500/20 text-purple-300',
  I: 'bg-green-500/20 text-green-300',
  C: 'bg-slate-500/20 text-slate-400',
};

interface Props { code: string; isAdmin: boolean; }

export default function CustomerClient({ code, isAdmin }: Props) {
  usePageTracking();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'open' | 'history' | 'shipto'>('open');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/sales/customers/${encodeURIComponent(code)}`);
        if (res.status === 404) { setError('Customer not found'); return; }
        if (!res.ok) { setError('Failed to load customer'); return; }
        setData(await res.json());
      } catch {
        setError('Failed to load customer');
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Link href="/sales" className="text-sm text-cyan-400 hover:underline">&larr; Sales Hub</Link>
        <div className="mt-4 text-center text-slate-400">{error || 'Customer not found'}</div>
      </div>
    );
  }

  const { customer, open_orders, history, ship_to } = data;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <Link href="/sales/transactions" className="text-sm text-cyan-400 hover:underline">&larr; Transactions</Link>
        <div className="flex items-start justify-between mt-1 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">{customer.cust_name ?? code}</h1>
            <p className="text-sm text-slate-400 font-mono">{code}</p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg text-sm font-medium">
              {data.open_count} open
            </span>
            <span className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium">
              {data.total_count} total
            </span>
          </div>
        </div>
      </div>

      {/* Customer info card */}
      <div className="bg-slate-900 border border-white/10 rounded-xl p-4">
        <div className="flex flex-wrap gap-6">
          {(customer.address_1 || customer.city) && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-300">
                {customer.address_1 && <div>{customer.address_1}</div>}
                {(customer.city || customer.state) && (
                  <div>{[customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}</div>
                )}
              </div>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="text-sm text-slate-300">{customer.phone}</span>
            </div>
          )}
          {ship_to.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="text-sm text-slate-300">{ship_to.length} ship-to address{ship_to.length !== 1 ? 'es' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {([
          { key: 'open', label: `Open Orders (${open_orders.length})`, icon: ShoppingCart },
          { key: 'history', label: `History (${history.length})`, icon: History },
          { key: 'shipto', label: `Ship-To (${ship_to.length})`, icon: MapPin },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === key
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'open' && <OrderTable orders={open_orders} isAdmin={isAdmin} />}
      {tab === 'history' && <OrderTable orders={history} isAdmin={isAdmin} dateField="invoice_date" />}
      {tab === 'shipto' && (
        <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
          {ship_to.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-500">No ship-to addresses</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Seq</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Address</th>
                </tr>
              </thead>
              <tbody>
                {ship_to.map((s) => (
                  <tr key={s.shipto_seq} className="border-b border-white/5 hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{s.shipto_seq}</td>
                    <td className="px-4 py-3 text-slate-200">{s.shipto_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      {[s.address_1, s.city, s.state].filter(Boolean).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function OrderTable({ orders, isAdmin, dateField = 'expect_date' }: {
  orders: Order[]; isAdmin: boolean; dateField?: 'expect_date' | 'invoice_date';
}) {
  if (orders.length === 0) {
    return <div className="text-center py-10 text-slate-500">No orders</div>;
  }
  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">SO #</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Reference</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">{dateField === 'invoice_date' ? 'Invoice Date' : 'Expect Date'}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Type</th>
              {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Branch</th>}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={`${o.so_number}-${o.system_id}`} className="border-b border-white/5 hover:bg-slate-800/50">
                <td className="px-4 py-3 font-mono text-cyan-400 font-medium">{o.so_number}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[o.so_status?.toUpperCase()] ?? 'bg-slate-700 text-slate-300'}`}>
                    {o.so_status?.toUpperCase() ?? '?'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs max-w-[160px] truncate">{o.reference ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300 text-xs">{(dateField === 'invoice_date' ? o.invoice_date : o.expect_date) ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{o.sale_type ?? '—'}</td>
                {isAdmin && <td className="px-4 py-3 text-slate-400 text-xs">{o.system_id}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
