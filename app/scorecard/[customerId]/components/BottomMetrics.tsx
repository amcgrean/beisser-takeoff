import type { KpiComparison, DaysToPayData } from '@/lib/scorecard/types';

function fmt$(n: number | null): string {
  if (n === null || n === undefined) return '—';
  if (n === 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(num: number | null, den: number | null): string {
  if (num === null || den === null || den === 0) return '—';
  return `${((num / den) * 100).toFixed(2)}%`;
}

function fmtN(n: number | null): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString();
}

function fmtAvg(n: number | null): string {
  if (n === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDays(n: number | null): string {
  if (n === null) return '—';
  return `${n} days`;
}

interface MetricRowProps {
  label: string;
  base: string;
  compare: string;
  tooltip?: string;
}

function MetricRow({ label, base, compare, tooltip }: MetricRowProps) {
  return (
    <tr className="border-b border-slate-800">
      <td className="py-2 text-slate-300 text-sm" title={tooltip}>
        {label}
        {tooltip && <span className="ml-1 text-slate-500 text-xs cursor-help">(?)</span>}
      </td>
      <td className="py-2 text-right font-mono tabular-nums text-white text-sm pr-4">{base}</td>
      <td className="py-2 text-right font-mono tabular-nums text-slate-400 text-sm">{compare}</td>
    </tr>
  );
}

interface Props {
  kpis: KpiComparison;
  daysToPay: DaysToPayData;
  baseYear: number;
  compareYear: number;
}

export default function BottomMetrics({ kpis, daysToPay, baseYear, compareYear }: Props) {
  const b = kpis.base;
  const c = kpis.compare;

  const avgSoBase = b.soCount && b.soCount > 0 && b.grossSales !== null
    ? b.grossSales / b.soCount : null;
  const avgSoCompare = c.soCount && c.soCount > 0 && c.grossSales !== null
    ? c.grossSales / c.soCount : null;

  const avgWtBase = b.soCount && b.soCount > 0 && b.totalWeight !== null
    ? b.totalWeight / b.soCount : null;
  const avgWtCompare = c.soCount && c.soCount > 0 && c.totalWeight !== null
    ? c.totalWeight / c.soCount : null;

  const cmRatioBase = b.soCount && b.soCount > 0 && b.cmCount !== null
    ? b.cmCount / b.soCount : null;
  const cmRatioCompare = c.soCount && c.soCount > 0 && c.cmCount !== null
    ? c.cmCount / c.soCount : null;

  const cmPctBase = b.sales !== null && b.cmSales !== null && b.sales !== 0
    ? Math.abs(b.cmSales) / Math.abs(b.sales) : null;
  const cmPctCompare = c.sales !== null && c.cmSales !== null && c.sales !== 0
    ? Math.abs(c.cmSales) / Math.abs(c.sales) : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm print:text-xs">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="pb-2 text-left text-slate-400 font-medium" />
            <th className="pb-2 text-right text-slate-300 font-semibold pr-4">{baseYear}</th>
            <th className="pb-2 text-right text-slate-300 font-semibold">{compareYear}</th>
          </tr>
        </thead>
        <tbody>
          <MetricRow
            label="Gross Sales (before CMs)"
            base={fmt$(b.grossSales)}
            compare={fmt$(c.grossSales)}
          />
          <MetricRow
            label="Credit Memos"
            base={fmt$(b.cmSales)}
            compare={fmt$(c.cmSales)}
          />
          <MetricRow
            label="CMs as % of Sales"
            base={cmPctBase !== null ? `${(cmPctBase * 100).toFixed(2)}%` : '—'}
            compare={cmPctCompare !== null ? `${(cmPctCompare * 100).toFixed(2)}%` : '—'}
          />
          <MetricRow
            label="# Sales Orders"
            base={fmtN(b.soCount)}
            compare={fmtN(c.soCount)}
          />
          <MetricRow
            label="# Credit Memos"
            base={fmtN(b.cmCount)}
            compare={fmtN(c.cmCount)}
          />
          <MetricRow
            label="# CMs / # SOs"
            base={cmRatioBase !== null ? cmRatioBase.toFixed(3) : '—'}
            compare={cmRatioCompare !== null ? cmRatioCompare.toFixed(3) : '—'}
          />
          <MetricRow
            label="Avg Sales Order $"
            base={fmtAvg(avgSoBase)}
            compare={fmtAvg(avgSoCompare)}
          />
          <MetricRow
            label="Avg Sales Order Weight (lbs)"
            base={avgWtBase !== null ? Math.round(avgWtBase).toLocaleString() : '—'}
            compare={avgWtCompare !== null ? Math.round(avgWtCompare).toLocaleString() : '—'}
          />
          <MetricRow
            label="Non-Stock Sales $"
            base={fmt$(b.nsSales)}
            compare={fmt$(c.nsSales)}
          />
          <MetricRow
            label="Non-Stock GP $"
            base={fmt$(b.nsGp)}
            compare={fmt$(c.nsGp)}
          />
          <MetricRow
            label="Non-Stock GP %"
            base={fmtPct(b.nsGp, b.nsSales)}
            compare={fmtPct(c.nsGp, c.nsSales)}
          />
          <MetricRow
            label="Average Days to Pay"
            base={fmtDays(daysToPay.base)}
            compare={fmtDays(daysToPay.compare)}
            tooltip="Based on payment history from AR records"
          />
          <MetricRow
            label="% Quotes Won"
            base="Not yet available"
            compare="Not yet available"
            tooltip="Quote sync not yet configured — will show automatically once vw_agility_quotes is added to Pi sync"
          />
          <MetricRow
            label="Value Add % of Sales"
            base={fmtPct(b.vaSales, b.sales)}
            compare={fmtPct(c.vaSales, c.sales)}
          />
        </tbody>
      </table>
    </div>
  );
}
