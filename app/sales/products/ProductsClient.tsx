'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Search, Package } from 'lucide-react';

interface Product {
  item_number: string;
  description: string | null;
  handling_code: string | null;
  system_id: string | null;
}

interface Props {
  isAdmin: boolean;
  userBranch: string | null;
}

const HC_COLORS: Record<string, string> = {
  DOOR1: 'bg-blue-500/20 text-blue-300',
  EWP: 'bg-emerald-500/20 text-emerald-300',
  TRIM: 'bg-purple-500/20 text-purple-300',
  DECK: 'bg-orange-500/20 text-orange-300',
  STAIR: 'bg-yellow-500/20 text-yellow-300',
};

export default function ProductsClient({ isAdmin, userBranch }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState(userBranch ?? '');
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = async (query: string, br: string) => {
    if (query.length < 2) { setProducts([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: query, limit: '50' });
      if (br) params.set('branch', br);
      const res = await fetch(`/api/sales/products?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setProducts(data.products ?? []);
    } finally {
      setLoading(false);
    }
  };

  const handleQChange = (v: string) => {
    setQ(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v, branch), 300);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <Link href="/sales" className="text-sm text-cyan-400 hover:underline">&larr; Sales Hub</Link>
        <h1 className="text-2xl font-bold text-white mt-1">Products &amp; Stock</h1>
        <p className="text-sm text-slate-400">Search item catalog with handling codes</p>
      </div>

      <div className="bg-slate-900 border border-white/10 rounded-xl p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => handleQChange(e.target.value)}
              placeholder="Item number or description (min 2 chars)..."
              className="w-full bg-slate-800 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          {isAdmin && (
            <input
              value={branch}
              onChange={(e) => { setBranch(e.target.value); search(q, e.target.value); }}
              placeholder="Branch"
              className="w-28 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {!searched ? 'Type to search items' : `${products.length} items found`}
          </span>
          {loading && <span className="text-xs text-cyan-400 animate-pulse">Searching...</span>}
        </div>

        {!searched ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
            <Package className="w-10 h-10 opacity-30" />
            <p className="text-sm">Search by item number or description</p>
          </div>
        ) : products.length === 0 && !loading ? (
          <div className="px-4 py-12 text-center text-slate-500">
            No items found for <span className="text-slate-300">&ldquo;{q}&rdquo;</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Item #</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Handling</th>
                  {isAdmin && <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Branch</th>}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.item_number} className="border-b border-white/5 hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-cyan-400 font-medium text-xs">{p.item_number}</td>
                    <td className="px-4 py-3 text-slate-200">{p.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      {p.handling_code ? (
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${HC_COLORS[p.handling_code] ?? 'bg-slate-700 text-slate-300'}`}>
                          {p.handling_code}
                        </span>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                    {isAdmin && <td className="px-4 py-3 text-slate-400 text-xs">{p.system_id ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
