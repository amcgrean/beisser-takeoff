'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, AlertCircle, Info, CheckCircle, Plus, X, ExternalLink } from 'lucide-react';
import { usePageTracking } from '@/hooks/usePageTracking';

type Exception = {
  event_type: string;
  event_status: string;
  system_id: string | null;
  po_number: string;
  supplier_key: string | null;
  supplier_name: string | null;
  buyer: string | null;
  severity: string;
  summary: string | null;
  event_date: string | null;
};

type Summary = {
  total: number; high: number; medium: number; low: number;
  by_type: { OVERDUE_NO_RECEIPT: number; SHORT_RECEIVE: number; OVERDUE_PO: number };
  buyers: string[];
};

const SEVERITY_STYLE: Record<string, { icon: React.ReactNode; badge: string; row: string }> = {
  high:   {
    icon:  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
    badge: 'bg-red-900/40 text-red-300 border-red-700/50',
    row:   'hover:bg-red-950/20',
  },
  medium: {
    icon:  <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />,
    badge: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
    row:   'hover:bg-yellow-950/20',
  },
  low:    {
    icon:  <Info className="w-3.5 h-3.5 text-blue-400" />,
    badge: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
    row:   'hover:bg-gray-800/40',
  },
};

const TYPE_LABEL: Record<string, string> = {
  OVERDUE_NO_RECEIPT: 'Overdue — No Receipt',
  OVERDUE_PO:         'Overdue — Partial Receipt',
  SHORT_RECEIVE:      'Short Receive',
};

const BRANCHES = ['10FD', '20GR', '25BW', '40CV'];

interface Props { isAdmin: boolean; userBranch: string | null; }

export default function ExceptionsClient({ isAdmin, userBranch }: Props) {
  usePageTracking();
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [branch,   setBranch]   = useState(isAdmin ? '' : (userBranch ?? ''));
  const [type,     setType]     = useState('');
  const [severity, setSeverity] = useState('');
  const [buyer,    setBuyer]    = useState('');

  // Task creation modal
  const [taskTarget, setTaskTarget] = useState<Exception | null>(null);
  const [taskTitle,  setTaskTitle]  = useState('');
  const [taskNote,   setTaskNote]   = useState('');
  const [taskPriority, setTaskPriority] = useState('high');
  const [savingTask, setSavingTask] = useState(false);
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (branch)   sp.set('branch', branch);
      if (type)     sp.set('type', type);
      if (severity) sp.set('severity', severity);
      if (buyer)    sp.set('buyer', buyer);
      const res = await fetch(`/api/purchasing/exceptions?${sp}`);
      if (!res.ok) throw new Error('Failed');
      const d = await res.json() as { exceptions: Exception[]; summary: Summary };
      setExceptions(d.exceptions);
      setSummary(d.summary);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [branch, type, severity, buyer]);

  useEffect(() => { load(); }, [load]);

  function openTaskModal(ex: Exception) {
    setTaskTarget(ex);
    setTaskTitle(`Follow up on PO #${ex.po_number} — ${TYPE_LABEL[ex.event_type] ?? ex.event_type}`);
    setTaskNote(ex.summary ?? '');
    setTaskPriority(ex.severity === 'high' ? 'high' : ex.severity === 'medium' ? 'medium' : 'low');
    setTaskSuccess(null);
  }

  async function createTask() {
    if (!taskTarget || !taskTitle.trim()) return;
    setSavingTask(true);
    try {
      const res = await fetch('/api/purchasing/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskNote.trim() || undefined,
          po_number: taskTarget.po_number,
          system_id: taskTarget.system_id,
          priority: taskPriority,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setTaskSuccess(`Task created for PO #${taskTarget.po_number}`);
      setTimeout(() => { setTaskTarget(null); setTaskSuccess(null); }, 1500);
    } catch {
      alert('Failed to create task.');
    } finally {
      setSavingTask(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Purchasing Exceptions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live exceptions from ERP — overdue POs and short receives</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-300 hover:text-white transition disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* KPI tiles */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center lg:col-span-1">
            <div className="text-2xl font-bold text-white">{summary.total}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total</div>
          </div>
          <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{summary.high}</div>
            <div className="text-xs text-gray-500 mt-0.5">High</div>
          </div>
          <div className="bg-yellow-950/30 border border-yellow-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{summary.medium}</div>
            <div className="text-xs text-gray-500 mt-0.5">Medium</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{summary.low}</div>
            <div className="text-xs text-gray-500 mt-0.5">Low</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-orange-400">{summary.by_type.OVERDUE_NO_RECEIPT}</div>
            <div className="text-xs text-gray-500 mt-0.5">No Receipt</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-purple-400">{summary.by_type.SHORT_RECEIVE + summary.by_type.OVERDUE_PO}</div>
            <div className="text-xs text-gray-500 mt-0.5">Short/Partial</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {isAdmin && (
          <select
            value={branch} onChange={(e) => setBranch(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
          >
            <option value="">All Branches</option>
            {BRANCHES.map((b) => <option key={b}>{b}</option>)}
          </select>
        )}
        <select
          value={type} onChange={(e) => setType(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={severity} onChange={(e) => setSeverity(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
        >
          <option value="">All Severity</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {summary && summary.buyers.length > 0 && (
          <select
            value={buyer} onChange={(e) => setBuyer(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
          >
            <option value="">All Buyers</option>
            {summary.buyers.map((b) => <option key={b}>{b}</option>)}
          </select>
        )}
        {(branch || type || severity || buyer) && (
          <button
            onClick={() => { setBranch(isAdmin ? '' : (userBranch ?? '')); setType(''); setSeverity(''); setBuyer(''); }}
            className="text-xs text-gray-500 hover:text-white flex items-center gap-1 px-2"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading exceptions…</div>
      ) : exceptions.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm flex flex-col items-center gap-2">
          <CheckCircle className="w-8 h-8 text-green-600" />
          No exceptions match the current filters.
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider text-left">
                <th className="px-4 py-3">Sev</th>
                <th className="px-4 py-3">PO #</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Buyer</th>
                {isAdmin && <th className="px-4 py-3">Branch</th>}
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((ex, i) => {
                const sev = SEVERITY_STYLE[ex.severity] ?? SEVERITY_STYLE.low;
                return (
                  <tr key={i} className={`border-b border-gray-800/50 transition-colors ${sev.row}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium ${sev.badge}`}>
                        {sev.icon} {ex.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/purchasing/pos/${ex.po_number}`}
                        className="font-mono text-cyan-300 hover:text-cyan-100 flex items-center gap-1"
                      >
                        {ex.po_number}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {TYPE_LABEL[ex.event_type] ?? ex.event_type}
                    </td>
                    <td className="px-4 py-3 text-gray-300 max-w-[180px] truncate text-xs">
                      {ex.supplier_name ?? ex.supplier_key ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{ex.buyer ?? '—'}</td>
                    {isAdmin && <td className="px-4 py-3 text-xs text-gray-500">{ex.system_id ?? '—'}</td>}
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[280px]">{ex.summary ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {ex.event_date ? new Date(ex.event_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openTaskModal(ex)}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-800 hover:bg-cyan-900/40 border border-gray-700 hover:border-cyan-700 text-gray-400 hover:text-cyan-300 rounded transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" /> Task
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-gray-600 border-t border-gray-800">
            {exceptions.length} exception{exceptions.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Task creation modal */}
      {taskTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Create Task</h3>
              <button onClick={() => setTaskTarget(null)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {taskSuccess ? (
              <div className="flex items-center gap-2 text-green-400 text-sm py-4 justify-center">
                <CheckCircle className="w-5 h-5" /> {taskSuccess}
              </div>
            ) : (
              <>
                <div className="text-xs text-gray-500 bg-gray-800 rounded px-3 py-2">
                  PO #{taskTarget.po_number} · {taskTarget.supplier_name ?? taskTarget.supplier_key} · {taskTarget.system_id}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Task Title *</label>
                    <input
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Notes</label>
                    <textarea
                      value={taskNote}
                      onChange={(e) => setTaskNote(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white w-full"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={createTask}
                    disabled={savingTask || !taskTitle.trim()}
                    className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
                  >
                    {savingTask ? 'Creating…' : 'Create Task'}
                  </button>
                  <button
                    onClick={() => setTaskTarget(null)}
                    className="px-4 py-2 text-gray-400 hover:text-white text-sm transition"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
