'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Phone, Mail, MapPin, DollarSign, Send } from 'lucide-react';

type Customer = {
  cust_key: string; cust_code: string; cust_name: string | null;
  phone: string | null; email: string | null;
  balance: number | null; credit_limit: number | null; terms: string | null; branch_code: string | null;
};

type Order = {
  so_number: string; so_status: string | null; expect_date: string | null;
  reference: string | null; sale_type: string | null; salesperson: string | null; line_count: number;
};

type ShipTo = {
  seq_num: number | null; shipto_name: string | null;
  address_1: string | null; city: string | null; state: string | null; zip: string | null; phone: string | null;
};

type Note = {
  id: number; note_type: string | null; body: string; rep_name: string | null; created_at: string | null;
};

type Tab = 'overview' | 'orders' | 'notes';

const SO_STATUS: Record<string, { label: string; color: string }> = {
  O: { label: 'Open',      color: 'text-blue-400' },
  K: { label: 'Picking',   color: 'text-yellow-400' },
  S: { label: 'Staged',    color: 'text-orange-400' },
  D: { label: 'Delivered', color: 'text-cyan-400' },
  I: { label: 'Invoiced',  color: 'text-green-400' },
  C: { label: 'Closed',    color: 'text-gray-500' },
};

const NOTE_TYPES = ['Call', 'Visit', 'Email', 'Quote Follow-Up', 'Issue', 'Other'];

export default function CustomerProfileClient({ code, userName }: { code: string; userName: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shiptos, setShiptos] = useState<ShipTo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [error, setError] = useState('');

  // Note form
  const [noteBody, setNoteBody] = useState('');
  const [noteType, setNoteType] = useState('Call');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sales/customers/${encodeURIComponent(code)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d: { customer: Customer; orders: Order[]; shiptos: ShipTo[] }) => {
        setCustomer(d.customer);
        setOrders(d.orders);
        setShiptos(d.shiptos);
      })
      .catch(() => setError('Customer not found or data unavailable.'))
      .finally(() => setLoading(false));
  }, [code]);

  const loadNotes = useCallback(() => {
    setNotesLoading(true);
    fetch(`/api/sales/customers/${encodeURIComponent(code)}/notes`)
      .then((r) => r.json())
      .then((d: { notes: Note[] }) => setNotes(d.notes))
      .catch(() => {})
      .finally(() => setNotesLoading(false));
  }, [code]);

  useEffect(() => {
    if (tab === 'notes') loadNotes();
  }, [tab, loadNotes]);

  async function submitNote() {
    if (!noteBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sales/customers/${encodeURIComponent(code)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: noteBody.trim(), note_type: noteType, rep_name: userName }),
      });
      if (!res.ok) throw new Error('Failed');
      const note = await res.json() as Note;
      setNotes((prev) => [note, ...prev]);
      setNoteBody('');
    } catch {
      alert('Failed to save note.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-500">Loading customer...</div>
    );
  }

  if (error || !customer) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/sales/customers" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </Link>
        <div className="text-red-400">{error || 'Customer not found.'}</div>
      </div>
    );
  }

  const openOrders = orders.filter((o) => o.so_status === 'O' || o.so_status === 'K');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back + title */}
      <Link href="/sales/customers" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </Link>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{customer.cust_name ?? customer.cust_code}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="font-mono text-cyan-300">{customer.cust_code}</span>
            {customer.branch_code && <span className="ml-2 text-gray-500">{customer.branch_code}</span>}
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="text-xl font-bold text-white">{openOrders.length}</div>
            <div className="text-gray-500 text-xs">Open Orders</div>
          </div>
          {customer.balance != null && (
            <div className="text-center">
              <div className="text-xl font-bold text-white">
                ${Math.abs(customer.balance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-gray-500 text-xs">Balance</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 mb-6">
        {(['overview', 'orders', 'notes'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}{t === 'orders' ? ` (${orders.length})` : ''}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Contact</h3>
            {customer.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-white">{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-white">{customer.email}</span>
              </div>
            )}
            {!customer.phone && !customer.email && (
              <p className="text-gray-600 text-sm">No contact info</p>
            )}
          </div>

          {/* Account */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Account</h3>
            <div className="flex items-center gap-3 text-sm">
              <DollarSign className="w-4 h-4 text-gray-500 shrink-0" />
              <div>
                <span className="text-gray-400">Balance: </span>
                <span className="text-white font-medium">
                  {customer.balance != null
                    ? `$${customer.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—'}
                </span>
              </div>
            </div>
            {customer.credit_limit != null && (
              <div className="text-sm text-gray-400">
                Credit Limit: <span className="text-white">${customer.credit_limit.toLocaleString()}</span>
              </div>
            )}
            {customer.terms && (
              <div className="text-sm text-gray-400">
                Terms: <span className="text-white">{customer.terms}</span>
              </div>
            )}
          </div>

          {/* Ship-to addresses */}
          {shiptos.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Ship-To Addresses</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shiptos.map((s, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                    <div>
                      {s.shipto_name && <div className="text-white font-medium">{s.shipto_name}</div>}
                      {s.address_1 && <div className="text-gray-400">{s.address_1}</div>}
                      {(s.city || s.state) && (
                        <div className="text-gray-400">{[s.city, s.state, s.zip].filter(Boolean).join(', ')}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick link to orders */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 md:col-span-2">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Activity (90 days)</h3>
            {orders.length === 0 ? (
              <p className="text-gray-600 text-sm">No orders in the last 90 days.</p>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 5).map((o) => (
                  <div key={o.so_number} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-cyan-300">{o.so_number}</span>
                      {o.reference && <span className="text-gray-400 truncate max-w-[200px]">{o.reference}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      {o.expect_date && <span className="text-gray-500">{new Date(o.expect_date).toLocaleDateString()}</span>}
                      <span className={SO_STATUS[o.so_status ?? '']?.color ?? 'text-gray-400'}>
                        {SO_STATUS[o.so_status ?? '']?.label ?? o.so_status ?? '—'}
                      </span>
                    </div>
                  </div>
                ))}
                {orders.length > 5 && (
                  <button onClick={() => setTab('orders')} className="text-xs text-cyan-400 hover:underline mt-1">
                    View all {orders.length} orders →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        <div>
          {orders.length === 0 ? (
            <p className="text-gray-500 text-sm">No orders in the last 90 days.</p>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">SO #</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Rep</th>
                    <th className="px-4 py-3 text-right">Expect Date</th>
                    <th className="px-4 py-3 text-right">Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.so_number} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-cyan-300 text-xs">{o.so_number}</td>
                      <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate">{o.reference ?? '—'}</td>
                      <td className={`px-4 py-3 font-medium ${SO_STATUS[o.so_status ?? '']?.color ?? 'text-gray-400'}`}>
                        {SO_STATUS[o.so_status ?? '']?.label ?? o.so_status ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 uppercase text-xs">{o.sale_type ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{o.salesperson ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {o.expect_date ? new Date(o.expect_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{o.line_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Notes tab */}
      {tab === 'notes' && (
        <div className="space-y-6">
          {/* Add note form */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-400 mb-4">Add Note</h3>
            <div className="flex gap-3 mb-3">
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              >
                {NOTE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={3}
              placeholder="Write a note about this customer..."
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={submitNote}
                disabled={submitting || !noteBody.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notesLoading && <p className="text-gray-500 text-sm">Loading notes...</p>}
          {!notesLoading && notes.length === 0 && (
            <p className="text-gray-600 text-sm">No notes yet.</p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {n.note_type && (
                    <span className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-gray-300">
                      {n.note_type}
                    </span>
                  )}
                  {n.rep_name && <span className="text-sm text-gray-400">{n.rep_name}</span>}
                </div>
                <span className="text-xs text-gray-600">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                </span>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
