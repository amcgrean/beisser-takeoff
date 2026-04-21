'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, FileImage, Mail, Calendar, Image as ImageIcon,
  FileText, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { usePageTracking } from '@/hooks/usePageTracking';

type CreditRow = {
  id: number; rma_number: string; filename: string; filepath: string;
  email_from: string | null; email_subject: string | null;
  received_at: string | null; uploaded_at: string | null;
  r2_key: string | null;
};

type CreditGroup = { rma_number: string; images: CreditRow[] };

type ListResponse = {
  mode: 'list'; rows: CreditRow[];
  total: number; page: number; totalPages: number;
};
type SearchResponse = {
  mode: 'search'; credits: CreditGroup[]; total: number;
};

function isImageFile(filename: string): boolean {
  return /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(filename);
}

function fmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function ViewButton({ imageId, filename }: { imageId: number; filename: string }) {
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const res = await fetch(`/api/credits/${imageId}/image`);
      if (!res.ok) throw new Error();
      const { url } = await res.json() as { url: string };
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      alert('Could not load file. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={open}
      disabled={loading}
      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-700/50 text-cyan-300 rounded transition-colors disabled:opacity-50"
      title={filename}
    >
      {loading
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : isImageFile(filename)
        ? <ImageIcon className="w-3 h-3" />
        : <FileText className="w-3 h-3" />}
      {loading ? 'Loading…' : 'View'}
    </button>
  );
}

export default function CreditsClient() {
  usePageTracking();

  const [q, setQ]             = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // List mode state
  const [rows, setRows]           = useState<CreditRow[]>([]);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]         = useState(0);

  // Search mode state
  const [groups, setGroups]       = useState<CreditGroup[]>([]);
  const [mode, setMode]           = useState<'list' | 'search'>('list');

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/credits?page=${p}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as ListResponse;
      setRows(data.rows);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      setMode('list');
    } catch {
      setError('Could not load credits.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPage(1); }, [loadPage]);

  async function search(query: string) {
    if (!query.trim()) { loadPage(1); return; }
    setLoading(true);
    setError('');
    try {
      const isRma = /^\d+/.test(query) || /^rma/i.test(query);
      const sp = new URLSearchParams();
      if (isRma) sp.set('rma', query.replace(/^rma/i, '').trim());
      else        sp.set('q', query);
      const res = await fetch(`/api/credits?${sp}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as SearchResponse;
      setGroups(data.credits);
      setMode('search');
    } catch {
      setError('Search unavailable.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    search(q);
  }

  function clearSearch() {
    setQ('');
    loadPage(1);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-cyan-400">RMA Credits</h1>
        <p className="text-sm text-gray-500 mt-1">Open credits from ERP — email submissions with attachments.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value) clearSearch();
            }}
            placeholder="RMA number or supplier email…"
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading || q.length < 2}
          className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
        >
          {loading && mode === 'search' ? 'Searching…' : 'Search'}
        </button>
        {mode === 'search' && (
          <button
            type="button"
            onClick={clearSearch}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* ── Default list view ── */}
      {mode === 'list' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">
              {loading ? 'Loading…' : `${total} open credit${total !== 1 ? 's' : ''}`}
            </p>
            {!loading && totalPages > 1 && (
              <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">RMA #</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">File</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">From</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Subject</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Received</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                      No open credits found.
                    </td>
                  </tr>
                )}
                {!loading && rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-cyan-400 font-medium whitespace-nowrap">
                      {row.rma_number}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isImageFile(row.filename)
                          ? <ImageIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          : <FileText className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
                        <span className="text-gray-300 truncate text-xs">{row.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell max-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-gray-600 shrink-0" />
                        <span className="text-gray-400 text-xs truncate">{row.email_from ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell max-w-[200px]">
                      <span className="text-gray-500 text-xs truncate block">{row.email_subject ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {fmt(row.received_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.r2_key
                        ? <ViewButton imageId={row.id} filename={row.filename} />
                        : <span className="text-xs text-gray-700 px-2 py-1 border border-gray-800 rounded">No preview</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => loadPage(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => loadPage(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Search results — grouped by RMA ── */}
      {mode === 'search' && !loading && (
        <>
          <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
            <span><span className="text-white font-medium">{groups.length}</span> RMA{groups.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>
              <span className="text-white font-medium">
                {groups.reduce((s, g) => s + g.images.length, 0)}
              </span> file{groups.reduce((s, g) => s + g.images.length, 0) !== 1 ? 's' : ''}
            </span>
          </div>

          {groups.length === 0 && (
            <p className="text-gray-500 text-sm">No open credits found for &ldquo;{q}&rdquo;.</p>
          )}

          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.rma_number} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <FileImage className="w-5 h-5 text-cyan-400" />
                    <span className="font-mono font-bold text-cyan-300">{group.rma_number}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {group.images.length} file{group.images.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="divide-y divide-gray-800">
                  {group.images.map((img) => (
                    <div key={img.id} className="px-5 py-3 text-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {isImageFile(img.filename)
                              ? <ImageIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                              : <FileText className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
                            <span className="text-gray-300 font-medium truncate">{img.filename}</span>
                          </div>
                          {img.email_from && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{img.email_from}</span>
                            </div>
                          )}
                          {img.email_subject && (
                            <div className="text-xs text-gray-600 truncate">{img.email_subject}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Calendar className="w-3 h-3" />
                            {fmt(img.received_at)}
                          </div>
                          {img.r2_key
                            ? <ViewButton imageId={img.id} filename={img.filename} />
                            : <span className="text-xs text-gray-700 px-2.5 py-1 border border-gray-800 rounded">No preview</span>
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
