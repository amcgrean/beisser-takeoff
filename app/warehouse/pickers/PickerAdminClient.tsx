'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, Plus, Pencil, Trash2, Check, X } from 'lucide-react';

interface Picker {
  id: number;
  name: string;
  user_type: string | null;
}

const USER_TYPE_OPTIONS = ['picker', 'door_builder', 'supervisor', null];

export default function PickerAdminClient() {
  const [pickers, setPickers] = useState<Picker[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<string>('');
  const [addMode, setAddMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('picker');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouse/pickers');
      if (!res.ok) return;
      const data = await res.json();
      setPickers(data.pickers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (p: Picker) => {
    setEditId(p.id);
    setEditName(p.name);
    setEditType(p.user_type ?? '');
  };

  const cancelEdit = () => { setEditId(null); };

  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/warehouse/pickers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, user_type: editType || null }),
      });
      if (!res.ok) return;
      await load();
      setEditId(null);
    } finally {
      setSaving(false);
    }
  };

  const deletePicker = async (id: number, name: string) => {
    if (!confirm(`Delete picker "${name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await fetch(`/api/warehouse/pickers/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const addPicker = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/warehouse/pickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), user_type: newType || null }),
      });
      if (!res.ok) return;
      setNewName('');
      setNewType('picker');
      setAddMode(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/warehouse" className="text-sm text-cyan-400 hover:underline">&larr; Warehouse</Link>
          <h1 className="text-2xl font-bold text-white mt-1">Picker Management</h1>
          <p className="text-sm text-slate-400">Add, edit, and remove pickers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAddMode(true)}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" /> Add Picker
          </button>
          <button onClick={load} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">ID</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Type</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {addMode && (
              <tr className="border-b border-cyan-500/30 bg-cyan-500/5">
                <td className="px-4 py-3 text-slate-500">new</td>
                <td className="px-4 py-3">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPicker()}
                    placeholder="Picker name"
                    autoFocus
                    className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500 w-full"
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    {USER_TYPE_OPTIONS.map((t) => (
                      <option key={t ?? ''} value={t ?? ''}>{t ?? '(none)'}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={addPicker} disabled={saving} className="text-green-400 hover:text-green-300 transition">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setAddMode(false)} className="text-slate-400 hover:text-white transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {pickers.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">No pickers found</td>
              </tr>
            ) : pickers.map((p) => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-slate-800/50">
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.id}</td>
                <td className="px-4 py-3">
                  {editId === p.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(p.id)}
                      className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500 w-full"
                    />
                  ) : (
                    <Link href={`/warehouse/pickers/${p.id}`} className="text-white hover:text-cyan-400 transition">
                      {p.name}
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editId === p.id ? (
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      {USER_TYPE_OPTIONS.map((t) => (
                        <option key={t ?? ''} value={t ?? ''}>{t ?? '(none)'}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-400 text-xs">{p.user_type ?? '—'}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editId === p.id ? (
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(p.id)} disabled={saving} className="text-green-400 hover:text-green-300 transition">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEdit} className="text-slate-400 hover:text-white transition">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(p)} className="text-slate-400 hover:text-cyan-400 transition">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deletePicker(p.id, p.name)} className="text-slate-400 hover:text-red-400 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
