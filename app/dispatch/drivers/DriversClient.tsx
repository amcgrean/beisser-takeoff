'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopNav } from '../../../src/components/nav/TopNav';
import { Plus, RefreshCw, Pencil, Trash2, X, Check, AlertCircle, UserCheck, UserX } from 'lucide-react';
import { usePageTracking } from '@/hooks/usePageTracking';

const BRANCHES = ['10FD', '20GR', '25BW', '40CV'];

interface Driver {
  id: number;
  name: string;
  phone: string | null;
  default_truck_id: string | null;
  branch_code: string | null;
  is_active: boolean;
  notes: string | null;
}

interface Props {
  isAdmin: boolean;
  userBranch: string | null;
  userName: string | null;
  userRole?: string;
}

const EMPTY = { name: '', phone: '', default_truck_id: '', branch_code: '', notes: '', is_active: true };

export default function DriversClient({ isAdmin, userBranch, userName, userRole }: Props) {
  usePageTracking();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Driver | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dispatch/drivers');
      if (res.ok) {
        const data = await res.json() as { drivers: Driver[] };
        setDrivers(data.drivers);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY, branch_code: userBranch ?? '' });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (d: Driver) => {
    setEditTarget(d);
    setForm({
      name: d.name,
      phone: d.phone ?? '',
      default_truck_id: d.default_truck_id ?? '',
      branch_code: d.branch_code ?? '',
      notes: d.notes ?? '',
      is_active: d.is_active,
    });
    setFormError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const url = editTarget ? `/api/dispatch/drivers/${editTarget.id}` : '/api/dispatch/drivers';
      const method = editTarget ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          default_truck_id: form.default_truck_id.trim() || null,
          branch_code: form.branch_code || null,
          notes: form.notes.trim() || null,
          is_active: form.is_active,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setFormError(data.error ?? 'Failed to save.');
        return;
      }
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dispatch/drivers/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) { setDeleteTarget(null); await load(); }
    } finally { setDeleting(false); }
  };

  return (
    <>
    <TopNav userName={userName} userRole={userRole} />
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400">Driver Roster</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage drivers for dispatch planning</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className="p-2 bg-gray-800 hover:bg-gray-700 rounded transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {isAdmin && (
              <button onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-sm rounded transition">
                <Plus className="w-4 h-4" /> Add Driver
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3">
            <div className="text-2xl font-bold">{drivers.length}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3">
            <div className="text-2xl font-bold text-green-300">{drivers.filter((d) => d.is_active).length}</div>
            <div className="text-xs text-gray-500">Active</div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3">
            <div className="text-2xl font-bold text-gray-500">{drivers.filter((d) => !d.is_active).length}</div>
            <div className="text-xs text-gray-500">Inactive</div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-700 text-sm text-gray-400">
            {loading ? 'Loading…' : `${drivers.length} drivers`}
          </div>
          {drivers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-700">
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-4 py-2 text-left font-medium">Phone</th>
                    <th className="px-4 py-2 text-left font-medium">Branch</th>
                    <th className="px-4 py-2 text-left font-medium">Default Truck</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    {isAdmin && <th className="px-4 py-2 text-left font-medium w-20"></th>}
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.id} className={`border-b border-gray-800 hover:bg-gray-800/40 transition-colors ${!d.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-gray-200">
                        {d.name}
                        {d.notes && <div className="text-xs text-gray-500 mt-0.5">{d.notes}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{d.phone || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{d.branch_code || 'All'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{d.default_truck_id || '—'}</td>
                      <td className="px-4 py-2.5">
                        {d.is_active ? (
                          <span className="flex items-center gap-1 text-xs text-green-400"><UserCheck className="w-3 h-3" /> Active</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-gray-500"><UserX className="w-3 h-3" /> Inactive</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => openEdit(d)} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(d)} className="p-1.5 hover:bg-red-900/40 rounded text-gray-500 hover:text-red-400 transition" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && drivers.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">No drivers found.</div>
          )}
        </div>
      </div>
    </div>

    {/* Create/Edit Modal */}
    {showForm && (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{editTarget ? 'Edit Driver' : 'Add Driver'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="John Smith"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="515-555-0100"
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Branch</label>
                <select value={form.branch_code} onChange={(e) => setForm((f) => ({ ...f, branch_code: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                  <option value="">All branches</option>
                  {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Default Truck (Samsara ID)</label>
              <input type="text" value={form.default_truck_id} onChange={(e) => setForm((f) => ({ ...f, default_truck_id: e.target.value }))}
                placeholder="e.g. 281474997057684"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="drv_active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="accent-cyan-500" />
              <label htmlFor="drv_active" className="text-sm text-gray-300">Active</label>
            </div>
          </div>
          {formError && (
            <div className="flex items-center gap-2 p-3 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded transition">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 rounded transition flex items-center gap-2">
              {saving ? 'Saving…' : <><Check className="w-4 h-4" /> Save</>}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Delete confirm */}
    {deleteTarget && (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-red-800 rounded-xl w-full max-w-sm p-6 space-y-4">
          <h2 className="text-lg font-bold">Remove Driver?</h2>
          <p className="text-sm text-gray-400">
            Remove <span className="text-white font-medium">{deleteTarget.name}</span> from the roster?
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded transition">Cancel</button>
            <button onClick={confirmDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded transition flex items-center gap-2">
              <Trash2 className="w-4 h-4" />{deleting ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
