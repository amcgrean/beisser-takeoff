import type { SaleTypeRow } from '@/lib/scorecard/types';

function fmt$(n: number): string {
  if (n === 0) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(sales: number, gp: number): string {
  if (sales === 0) return '—';
  return `${((gp / sales) * 100).toFixed(2)}%`;
}

interface Props {
  rows: SaleTypeRow[];
  baseYear: number;
  compareYear: number;
}

export default function SaleTypeTable({ rows, baseYear, compareYear }: Props) {
  if (rows.length === 0) return null;

  const totalBase = rows.reduce((s, r) => s + r.salesBase, 0);
  const totalCompare = rows.reduce((s, r) => s + r.salesCompare, 0);
  const totalGpBase = rows.reduce((s, r) => s + r.gpBase, 0);
  const totalGpCompare = rows.reduce((s, r) => s + r.gpCompare, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm print:text-xs">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="pb-2 text-left text-slate-400 font-medium">Sale Type</th>
            <th className="pb-2 text-right text-slate-300 font-semibold pr-3">{baseYear} Sales</th>
            <th className="pb-2 text-right text-slate-300 font-semibold pr-3">{baseYear} GP</th>
            <th className="pb-2 text-right text-slate-300 font-semibold pr-3">{baseYear} GM%</th>
            <th className="pb-2 text-right text-slate-300 font-semibold pr-3">{compareYear} Sales</th>
            <th className="pb-2 text-right text-slate-300 font-semibold pr-3">{compareYear} GP</th>
            <th className="pb-2 text-right text-slate-300 font-semibold">{compareYear} GM%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category} className="border-b border-slate-800">
              <td className="py-2 text-slate-200">{r.category}</td>
              <td className="py-2 text-right font-mono tabular-nums text-white pr-3">{fmt$(r.salesBase)}</td>
              <td className="py-2 text-right font-mono tabular-nums text-white pr-3">{fmt$(r.gpBase)}</td>
              <td className="py-2 text-right font-mono tabular-nums text-cyan-400 pr-3">{fmtPct(r.salesBase, r.gpBase)}</td>
              <td className="py-2 text-right font-mono tabular-nums text-slate-400 pr-3">{fmt$(r.salesCompare)}</td>
              <td className="py-2 text-right font-mono tabular-nums text-slate-400 pr-3">{fmt$(r.gpCompare)}</td>
              <td className="py-2 text-right font-mono tabular-nums text-slate-400">{fmtPct(r.salesCompare, r.gpCompare)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-600 font-semibold">
            <td className="py-2 text-slate-200">Total</td>
            <td className="py-2 text-right font-mono tabular-nums text-white pr-3">{fmt$(totalBase)}</td>
            <td className="py-2 text-right font-mono tabular-nums text-white pr-3">{fmt$(totalGpBase)}</td>
            <td className="py-2 text-right font-mono tabular-nums text-cyan-400 pr-3">{fmtPct(totalBase, totalGpBase)}</td>
            <td className="py-2 text-right font-mono tabular-nums text-slate-400 pr-3">{fmt$(totalCompare)}</td>
            <td className="py-2 text-right font-mono tabular-nums text-slate-400 pr-3">{fmt$(totalGpCompare)}</td>
            <td className="py-2 text-right font-mono tabular-nums text-slate-400">{fmtPct(totalCompare, totalGpCompare)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
