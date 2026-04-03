'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, CheckCircle, Clock, Activity, BarChart2 } from 'lucide-react';

interface PickerDetail {
  picker: { id: number; name: string; user_type: string | null };
  recent_picks: {
    id: number;
    barcode_number: string | null;
    start_time: string | null;
    completed_time: string | null;
    pick_type_id: number | null;
  }[];
  stats: {
    total_picks: number;
    today_picks: number;
    avg_minutes: number | null;
  };
}

interface Props { id: string; }

function duration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
  return `${mins}m`;
}

export default function PickerDetailClient({ id }: Props) {
  const [data, setData] = useState<PickerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/warehouse/pickers/${id}`);
        if (res.status === 404) { setError('Picker not found'); return; }
        if (!res.ok) { setError('Failed to load picker'); return; }
        setData(await res.json());
      } catch {
        setError('Failed to load picker');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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
        <Link href="/warehouse/open-picks" className="text-sm text-cyan-400 hover:underline">&larr; Open Picks</Link>
        <div className="mt-8 text-center text-slate-400">{error || 'Picker not found'}</div>
      </div>
    );
  }

  const { picker, recent_picks, stats } = data;
  const activePicks = recent_picks.filter((p) => !p.completed_time);
  const completedPicks = recent_picks.filter((p) => p.completed_time);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <Link href="/warehouse/open-picks" className="text-sm text-cyan-400 hover:underline">&larr; Open Picks</Link>
        <div className="flex items-center justify-between mt-1 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">{picker.name}</h1>
            <p className="text-sm text-slate-400">{picker.user_type ?? 'Picker'} &bull; ID {picker.id}</p>
          </div>
          {activePicks.length > 0 && (
            <span className="px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg text-sm font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Currently Picking
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Today\'s Picks', value: stats.today_picks, icon: Activity },
          { label: 'Total Picks', value: stats.total_picks, icon: BarChart2 },
          { label: 'Avg Time', value: stats.avg_minutes != null ? `${stats.avg_minutes}m` : '—', icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-slate-900 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Active picks */}
      {activePicks.length > 0 && (
        <div className="bg-slate-900 border border-green-500/30 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Active Picks
          </h2>
          <div className="space-y-2">
            {activePicks.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-sm text-white font-mono">{p.barcode_number ?? `#${p.id}`}</span>
                <span className="text-xs text-slate-400">
                  {p.start_time ? `Started ${new Date(p.start_time).toLocaleTimeString()}` : 'In progress'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent completed */}
      <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Recent Picks ({completedPicks.length})</h2>
        </div>
        {completedPicks.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-500">No completed picks</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Barcode</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Started</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Completed</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Duration</th>
              </tr>
            </thead>
            <tbody>
              {completedPicks.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-mono text-slate-300 text-xs">{p.barcode_number ?? `#${p.id}`}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {p.start_time ? new Date(p.start_time).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      {p.completed_time ? new Date(p.completed_time).toLocaleString() : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {duration(p.start_time, p.completed_time) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
