'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PackageCheck, ClipboardCheck, List } from 'lucide-react';
import { usePageTracking } from '@/hooks/usePageTracking';

type Po = {
  po_number: string;
  supplier_name: string | null;
  system_id: string | null;
  expect_date: string | null;
  po_status: string | null;
  receipt_count: number | null;
};

type Submission = {
  id: string;
  po_number: string;
  supplier_name: string | null;
  status: string;
  priority: string | null;
  created_at: string | null;
  submitted_username: string | null;
};

export default function WorkspaceClient({ userBranch }: { userBranch: string | null }) {
  usePageTracking();
  const [pos, setPos] = useState<Po[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (userBranch) sp.set('branch', userBranch);

    Promise.all([
      fetch(`/api/purchasing/pos/open?${sp}`).then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/purchasing/submissions?status=pending&days=7`).then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([posData, subsData]) => {
      setPos((posData as Po[]).slice(0, 20));
      setSubmissions(Array.isArray(subsData) ? (subsData as Submission[]).slice(0, 10) : []);
      setLoading(false);
    });
  }, [userBranch]);

  const today = new Date().toISOString().split('T')[0];
  const overdue = pos.filter((p) => p.expect_date && p.expect_date < today);
  const pending = submissions.filter((s) => s.status === 'pending');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-cyan-400">Buyer Workspace</h1>
        {userBranch && <p className="text-sm text-gray-500 mt-0.5">Branch: {userBranch}</p>}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link href="/purchasing" className="bg-gray-900 border border-gray-800 hover:border-cyan-700 rounded-lg p-5 flex items-center gap-4 transition-colors">
          <PackageCheck className="w-8 h-8 text-cyan-400 shrink-0" />
          <div>
            <div className="font-semibold text-white">PO Check-In</div>
            <div className="text-xs text-gray-500 mt-0.5">Photograph incoming goods</div>
          </div>
        </Link>
        <Link href="/purchasing/review" className="bg-gray-900 border border-gray-800 hover:border-cyan-700 rounded-lg p-5 flex items-center gap-4 transition-colors group">
          <ClipboardCheck className="w-8 h-8 text-cyan-400 shrink-0" />
          <div>
            <div className="font-semibold text-white flex items-center gap-2">
              Review Submissions
              {pending.length > 0 && (
                <span className="text-xs bg-yellow-900/60 text-yellow-300 border border-yellow-700 rounded px-1.5">{pending.length}</span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Review pending check-ins</div>
          </div>
        </Link>
        <Link href="/purchasing/open-pos" className="bg-gray-900 border border-gray-800 hover:border-cyan-700 rounded-lg p-5 flex items-center gap-4 transition-colors">
          <List className="w-8 h-8 text-cyan-400 shrink-0" />
          <div>
            <div className="font-semibold text-white flex items-center gap-2">
              Open POs
              {overdue.length > 0 && (
                <span className="text-xs bg-red-900/60 text-red-300 border border-red-700 rounded px-1.5">{overdue.length} overdue</span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Browse open purchase orders</div>
          </div>
        </Link>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upcoming POs */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Upcoming POs</h3>
              <Link href="/purchasing/open-pos" className="text-xs text-cyan-400 hover:underline">View all</Link>
            </div>
            {pos.length === 0 ? (
              <p className="text-gray-600 text-sm">No open POs.</p>
            ) : (
              <div className="space-y-2">
                {pos.slice(0, 10).map((p) => {
                  const isOverdue = p.expect_date && p.expect_date < today;
                  return (
                    <div key={p.po_number} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-mono text-cyan-300 text-xs">{p.po_number}</span>
                        {p.supplier_name && <span className="ml-2 text-gray-400 text-xs truncate max-w-[140px]">{p.supplier_name}</span>}
                      </div>
                      <span className={`text-xs shrink-0 ${isOverdue ? 'text-red-400 font-medium' : 'text-gray-500'}`}>
                        {p.expect_date ? new Date(p.expect_date).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending submissions */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Check-Ins</h3>
              <Link href="/purchasing/review" className="text-xs text-cyan-400 hover:underline">Review all</Link>
            </div>
            {submissions.length === 0 ? (
              <p className="text-gray-600 text-sm">No submissions in the last 7 days.</p>
            ) : (
              <div className="space-y-2">
                {submissions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-mono text-cyan-300 text-xs">{s.po_number}</span>
                      {s.supplier_name && <span className="ml-2 text-gray-400 text-xs">{s.supplier_name}</span>}
                      {s.priority === 'high' && <span className="ml-1 text-xs text-red-300">HIGH</span>}
                    </div>
                    <span className={`text-xs shrink-0 ${s.status === 'pending' ? 'text-yellow-400' : s.status === 'flagged' ? 'text-red-400' : 'text-green-400'}`}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
