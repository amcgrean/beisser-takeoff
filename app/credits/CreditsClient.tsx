'use client';

import { useState } from 'react';
import { Search, FileImage, Mail, Calendar } from 'lucide-react';

type CreditImage = {
  id: number; rma_number: string; filename: string; filepath: string;
  email_from: string | null; email_subject: string | null;
  received_at: string | null; uploaded_at: string | null;
};

type CreditGroup = {
  rma_number: string;
  images: CreditImage[];
};

export default function CreditsClient() {
  const [q, setQ] = useState('');
  const [credits, setCredits] = useState<CreditGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function search(query: string) {
    if (query.length < 2) { setCredits([]); setSearched(false); return; }
    setLoading(true);
    setError('');
    try {
      // Try as RMA number first, then general search
      const isRma = /^\d+/.test(query) || /^rma/i.test(query);
      const sp = new URLSearchParams();
      if (isRma) {
        sp.set('rma', query.replace(/^rma/i, '').trim());
      } else {
        sp.set('q', query);
      }
      const res = await fetch(`/api/credits?${sp}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json() as { credits: CreditGroup[]; total: number };
      setCredits(data.credits);
      setSearched(true);
    } catch {
      setError('Search unavailable');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    search(q);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-cyan-400">RMA Credits</h1>
        <p className="text-sm text-gray-500 mt-1">Search credit and RMA image records from email submissions.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); if (e.target.value.length === 0) { setCredits([]); setSearched(false); } }}
            placeholder="RMA number or supplier email..."
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-sm"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={loading || q.length < 2}
          className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {!searched && !loading && <p className="text-gray-500 text-sm">Enter an RMA number or email to search credit images.</p>}
      {searched && !loading && credits.length === 0 && <p className="text-gray-500 text-sm">No credit images found for &ldquo;{q}&rdquo;.</p>}

      {credits.length > 0 && (
        <div className="space-y-4">
          {credits.map((group) => (
            <div key={group.rma_number} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <FileImage className="w-5 h-5 text-cyan-400" />
                  <span className="font-mono font-bold text-cyan-300">{group.rma_number}</span>
                </div>
                <span className="text-xs text-gray-500">{group.images.length} image{group.images.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-800">
                {group.images.map((img) => (
                  <div key={img.id} className="px-5 py-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="text-gray-300 font-medium truncate">{img.filename}</div>
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
                      <div className="flex items-center gap-1 text-xs text-gray-600 shrink-0">
                        <Calendar className="w-3 h-3" />
                        {img.received_at
                          ? new Date(img.received_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
