'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Po = {
  po_number: string;
  supplier_name: string | null;
  system_id: string | null;
  expect_date: string | null;
  po_status: string | null;
  receipt_count: number | null;
};

type Submission = {
  id: string; po_number: string; supplier_name: string | null; status: string;
  priority: string | null; branch: string | null; created_at: string | null;
};

const BRANCHES = ['', '10FD', '20GR', '25BW', '40CV'];

export default function CommandCenterClient({ isAdmin }: { isAdmin: boolean }) {
  const [branch, setBranch] = useState('');
  const [pos, setPos] = useState<Po[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (branch) sp.set('branch', branch);

    Promise.all([
      fetch(`/api/purchasing/pos/open?${sp}`).then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/purchasing/submissions?days=14${branch ? `&branch=${branch}` : ''}`).then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([posData, subsData]) => {
      setPos(posData as Po[]);
      setSubmissions(Array.isArray(subsData) ? (subsData as Submission[]) : []);
      setLoading(false);
    });
  }, [branch]);

  const today = new Date().toISOString().split('T')[0];
  const overduePOs = pos.filter((p) => p.expect_date && p.expect_date < today);
  const pendingSubs = submissions.filter((s) => s.status === 'pending');
  const flaggedSubs = submissions.filter((s) => s.status === 'flagged');

  // POs by branch
  const byBranch = pos.reduce<Record<string, Po[]>>((acc, p) => {
    const br = p.system_id ?? 'Unknown';
    if (!acc[br]) acc[br] = [];
    acc[br].push(p);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-cyan-400">Purchasing Command Center</h1>
        {isAdmin && (
          <select
            value={branch}
            onChange={(e) => { setBranch(e.target.value); setLoading(true); }}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
          >
            {BRANCHES.map((b) => <option key={b} value={b}>{b || 'All Branches'}</option>)}
          </select>
        )}
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}

      {!loading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{pos.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Open POs</div>
            </div>
            <div className={`rounded-lg p-4 border ${overduePOs.length > 0 ? 'bg-red-900/20 border-red-800' : 'bg-gray-900 border-gray-800'}`}>
              <div className={`text-2xl font-bold ${overduePOs.length > 0 ? 'text-red-400' : 'text-white'}`}>{overduePOs.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Overdue POs</div>
            </div>
            <div className={`rounded-lg p-4 border ${pendingSubs.length > 0 ? 'bg-yellow-900/20 border-yellow-800' : 'bg-gray-900 border-gray-800'}`}>
              <div className={`text-2xl font-bold ${pendingSubs.length > 0 ? 'text-yellow-400' : 'text-white'}`}>{pendingSubs.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Pending Reviews</div>
            </div>
            <div className={`rounded-lg p-4 border ${flaggedSubs.length > 0 ? 'bg-red-900/20 border-red-800' : 'bg-gray-900 border-gray-800'}`}>
              <div className={`text-2xl font-bold ${flaggedSubs.length > 0 ? 'text-red-400' : 'text-white'}`}>{flaggedSubs.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Flagged</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* POs by branch */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">POs by Branch</h3>
                <Link href="/purchasing/open-pos" className="text-xs text-cyan-400 hover:underline">View all</Link>
              </div>
              {Object.keys(byBranch).length === 0 ? (
                <p className="text-gray-600 text-sm">No open POs.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(byBranch).map(([br, brPos]) => {
                    const brOverdue = brPos.filter((p) => p.expect_date && p.expect_date < today).length;
                    return (
                      <div key={br} className="flex items-center justify-between">
                        <span className="text-white font-medium">{br}</span>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-400">{brPos.length} POs</span>
                          {brOverdue > 0 && (
                            <span className="text-red-400 text-xs">{brOverdue} overdue</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent submissions */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Submissions (14d)</h3>
                <Link href="/purchasing/review" className="text-xs text-cyan-400 hover:underline">Review</Link>
              </div>
              {submissions.length === 0 ? (
                <p className="text-gray-600 text-sm">No submissions in the last 14 days.</p>
              ) : (
                <div className="space-y-2">
                  {submissions.slice(0, 10).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-300 text-xs">{s.po_number}</span>
                        {s.branch && <span className="text-xs text-gray-600">{s.branch}</span>}
                      </div>
                      <span className={`text-xs ${s.status === 'pending' ? 'text-yellow-400' : s.status === 'flagged' ? 'text-red-400' : 'text-green-400'}`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Overdue POs detail */}
            {overduePOs.length > 0 && (
              <div className="bg-red-900/10 border border-red-800/50 rounded-lg p-5 md:col-span-2">
                <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-4">
                  Overdue POs ({overduePOs.length})
                </h3>
                <div className="space-y-2">
                  {overduePOs.slice(0, 15).map((p) => (
                    <div key={p.po_number} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-cyan-300 text-xs">{p.po_number}</span>
                        <span className="text-gray-400">{p.supplier_name ?? '—'}</span>
                        <span className="text-gray-600 text-xs">{p.system_id}</span>
                      </div>
                      <span className="text-red-400 text-xs shrink-0">
                        Expected {p.expect_date ? new Date(p.expect_date).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  ))}
                  {overduePOs.length > 15 && (
                    <Link href="/purchasing/open-pos" className="text-xs text-cyan-400 hover:underline">
                      +{overduePOs.length - 15} more →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
