import { getErpSql } from '../../../db/supabase';
import type {
  ScorecardParams,
  KpiComparison,
  KpiSet,
  ProductMajorRow,
  ProductMinorRow,
  SaleTypeRow,
  ThreeYearEntry,
  DaysToPayData,
  CustomerListRow,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns YYYY-MM-DD clamped to the last valid day of month in `year`. */
function clampCutoff(year: number, month: number, day: number): string {
  // new Date(year, month, 0) = day-0 of following month = last day of `month`
  // month here is 1-indexed: new Date(2025, 2, 0) → Feb 28, 2025
  const lastDay = new Date(year, month, 0).getDate();
  const d = Math.min(day, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getCutoffs(
  baseYear: number,
  compareYear: number,
  cutoffDate: string,
  period: string,
): { baseCutoff: string; compareCutoff: string } {
  if (period === 'Full Year') {
    return {
      baseCutoff: `${baseYear}-12-31`,
      compareCutoff: `${compareYear}-12-31`,
    };
  }
  const d = new Date(cutoffDate);
  const month = d.getUTCMonth() + 1; // 1-indexed
  const day = d.getUTCDate();
  return {
    baseCutoff: clampCutoff(baseYear, month, day),
    compareCutoff: clampCutoff(compareYear, month, day),
  };
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n !== null ? Math.round(n) : null;
}

// ---------------------------------------------------------------------------
// Customer list (scorecard index page)
// ---------------------------------------------------------------------------

export async function fetchCustomerList(
  baseYear: number,
  compareYear: number,
  branchIds: string[],
  search: string,
  limit = 200,
): Promise<CustomerListRow[]> {
  const sql = getErpSql();

  type Row = {
    customer_id: string;
    customer_name: string;
    sales_base: string | null;
    sales_compare: string | null;
    gp_base: string | null;
    branch_ids: string[];
  };

  const rows = branchIds.length > 0
    ? await sql<Row[]>`
        SELECT
          customer_id,
          MAX(customer_name) AS customer_name,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${baseYear}
          )::numeric(18,2)::text AS sales_base,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${compareYear}
          )::numeric(18,2)::text AS sales_compare,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${baseYear}
          )::numeric(18,2)::text AS gp_base,
          array_agg(DISTINCT branch_id) FILTER (WHERE branch_id IS NOT NULL) AS branch_ids
        FROM customer_scorecard_fact
        WHERE is_deleted = false
          AND NOT is_sale_type_excluded
          AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${baseYear}, ${compareYear}]::int[])
          AND branch_id = ANY(${branchIds}::text[])
          AND (
            ${search} = ''
            OR customer_name ILIKE ${'%' + search + '%'}
            OR customer_id ILIKE ${'%' + search + '%'}
          )
        GROUP BY customer_id
        ORDER BY SUM(sales_amount) FILTER (
          WHERE EXTRACT(YEAR FROM invoice_date)::int = ${baseYear}
        ) DESC NULLS LAST
        LIMIT ${limit}
      `
    : await sql<Row[]>`
        SELECT
          customer_id,
          MAX(customer_name) AS customer_name,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${baseYear}
          )::numeric(18,2)::text AS sales_base,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${compareYear}
          )::numeric(18,2)::text AS sales_compare,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${baseYear}
          )::numeric(18,2)::text AS gp_base,
          array_agg(DISTINCT branch_id) FILTER (WHERE branch_id IS NOT NULL) AS branch_ids
        FROM customer_scorecard_fact
        WHERE is_deleted = false
          AND NOT is_sale_type_excluded
          AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${baseYear}, ${compareYear}]::int[])
          AND (
            ${search} = ''
            OR customer_name ILIKE ${'%' + search + '%'}
            OR customer_id ILIKE ${'%' + search + '%'}
          )
        GROUP BY customer_id
        ORDER BY SUM(sales_amount) FILTER (
          WHERE EXTRACT(YEAR FROM invoice_date)::int = ${baseYear}
        ) DESC NULLS LAST
        LIMIT ${limit}
      `;

  return rows.map((r) => ({
    customerId: r.customer_id,
    customerName: r.customer_name,
    salesBase: toNum(r.sales_base) ?? 0,
    salesCompare: toNum(r.sales_compare) ?? 0,
    gpBase: toNum(r.gp_base) ?? 0,
    branchIds: r.branch_ids ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Customer typeahead
// ---------------------------------------------------------------------------

export async function searchCustomers(
  query: string,
  limit = 20,
): Promise<{ customerId: string; customerName: string }[]> {
  const sql = getErpSql();
  type Row = { customer_id: string; customer_name: string };
  const rows = await sql<Row[]>`
    SELECT DISTINCT ON (customer_id) customer_id, customer_name
    FROM customer_scorecard_fact
    WHERE is_deleted = false
      AND (
        customer_name ILIKE ${'%' + query + '%'}
        OR customer_id ILIKE ${'%' + query + '%'}
      )
    ORDER BY customer_id, MAX(invoice_date) DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ customerId: r.customer_id, customerName: r.customer_name }));
}

// ---------------------------------------------------------------------------
// Main KPI aggregation
// ---------------------------------------------------------------------------

export async function fetchKpis(params: ScorecardParams): Promise<KpiComparison> {
  const sql = getErpSql();
  const { baseCutoff, compareCutoff } = getCutoffs(
    params.baseYear,
    params.compareYear,
    params.cutoffDate,
    params.period,
  );

  type Row = {
    customer_name: string | null;
    sales_base: string | null;
    sales_compare: string | null;
    gp_base: string | null;
    gp_compare: string | null;
    va_sales_base: string | null;
    va_sales_compare: string | null;
    ns_sales_base: string | null;
    ns_sales_compare: string | null;
    ns_gp_base: string | null;
    ns_gp_compare: string | null;
    gross_sales_base: string | null;
    gross_sales_compare: string | null;
    cm_sales_base: string | null;
    cm_sales_compare: string | null;
    so_count_base: string | null;
    so_count_compare: string | null;
    cm_count_base: string | null;
    cm_count_compare: string | null;
    weight_base: string | null;
    weight_compare: string | null;
    branch_ids: string[];
    ship_to_count: string | null;
  };

  const [rows] = params.branchIds.length > 0
    ? await sql<Row[]>`
        WITH f AS (
          SELECT
            customer_name,
            sales_amount, gross_profit, weight,
            sales_order_number, is_credit_memo, is_value_add_major, is_non_stock,
            ship_to_id, branch_id,
            (EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date) AS is_base,
            (EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date) AS is_compare
          FROM customer_scorecard_fact
          WHERE is_deleted = false
            AND NOT is_sale_type_excluded
            AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${params.baseYear}, ${params.compareYear}]::int[])
            AND customer_id = ${params.customerId}
            AND branch_id = ANY(${params.branchIds}::text[])
        )
        SELECT
          MAX(customer_name) AS customer_name,
          SUM(sales_amount) FILTER (WHERE is_base)::text AS sales_base,
          SUM(sales_amount) FILTER (WHERE is_compare)::text AS sales_compare,
          SUM(gross_profit) FILTER (WHERE is_base)::text AS gp_base,
          SUM(gross_profit) FILTER (WHERE is_compare)::text AS gp_compare,
          SUM(sales_amount) FILTER (WHERE is_base AND is_value_add_major)::text AS va_sales_base,
          SUM(sales_amount) FILTER (WHERE is_compare AND is_value_add_major)::text AS va_sales_compare,
          SUM(sales_amount) FILTER (WHERE is_base AND is_non_stock)::text AS ns_sales_base,
          SUM(sales_amount) FILTER (WHERE is_compare AND is_non_stock)::text AS ns_sales_compare,
          SUM(gross_profit) FILTER (WHERE is_base AND is_non_stock)::text AS ns_gp_base,
          SUM(gross_profit) FILTER (WHERE is_compare AND is_non_stock)::text AS ns_gp_compare,
          SUM(sales_amount) FILTER (WHERE is_base AND NOT is_credit_memo)::text AS gross_sales_base,
          SUM(sales_amount) FILTER (WHERE is_compare AND NOT is_credit_memo)::text AS gross_sales_compare,
          SUM(sales_amount) FILTER (WHERE is_base AND is_credit_memo)::text AS cm_sales_base,
          SUM(sales_amount) FILTER (WHERE is_compare AND is_credit_memo)::text AS cm_sales_compare,
          COUNT(DISTINCT CASE WHEN is_base AND NOT is_credit_memo THEN sales_order_number END)::text AS so_count_base,
          COUNT(DISTINCT CASE WHEN is_compare AND NOT is_credit_memo THEN sales_order_number END)::text AS so_count_compare,
          COUNT(DISTINCT CASE WHEN is_base AND is_credit_memo THEN sales_order_number END)::text AS cm_count_base,
          COUNT(DISTINCT CASE WHEN is_compare AND is_credit_memo THEN sales_order_number END)::text AS cm_count_compare,
          SUM(weight) FILTER (WHERE is_base AND NOT is_credit_memo)::text AS weight_base,
          SUM(weight) FILTER (WHERE is_compare AND NOT is_credit_memo)::text AS weight_compare,
          array_agg(DISTINCT branch_id) FILTER (WHERE branch_id IS NOT NULL) AS branch_ids,
          COUNT(DISTINCT ship_to_id)::text AS ship_to_count
        FROM f
      `
    : await sql<Row[]>`
        WITH f AS (
          SELECT
            customer_name,
            sales_amount, gross_profit, weight,
            sales_order_number, is_credit_memo, is_value_add_major, is_non_stock,
            ship_to_id, branch_id,
            (EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date) AS is_base,
            (EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date) AS is_compare
          FROM customer_scorecard_fact
          WHERE is_deleted = false
            AND NOT is_sale_type_excluded
            AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${params.baseYear}, ${params.compareYear}]::int[])
            AND customer_id = ${params.customerId}
        )
        SELECT
          MAX(customer_name) AS customer_name,
          SUM(sales_amount) FILTER (WHERE is_base)::text AS sales_base,
          SUM(sales_amount) FILTER (WHERE is_compare)::text AS sales_compare,
          SUM(gross_profit) FILTER (WHERE is_base)::text AS gp_base,
          SUM(gross_profit) FILTER (WHERE is_compare)::text AS gp_compare,
          SUM(sales_amount) FILTER (WHERE is_base AND is_value_add_major)::text AS va_sales_base,
          SUM(sales_amount) FILTER (WHERE is_compare AND is_value_add_major)::text AS va_sales_compare,
          SUM(sales_amount) FILTER (WHERE is_base AND is_non_stock)::text AS ns_sales_base,
          SUM(sales_amount) FILTER (WHERE is_compare AND is_non_stock)::text AS ns_sales_compare,
          SUM(gross_profit) FILTER (WHERE is_base AND is_non_stock)::text AS ns_gp_base,
          SUM(gross_profit) FILTER (WHERE is_compare AND is_non_stock)::text AS ns_gp_compare,
          SUM(sales_amount) FILTER (WHERE is_base AND NOT is_credit_memo)::text AS gross_sales_base,
          SUM(sales_amount) FILTER (WHERE is_compare AND NOT is_credit_memo)::text AS gross_sales_compare,
          SUM(sales_amount) FILTER (WHERE is_base AND is_credit_memo)::text AS cm_sales_base,
          SUM(sales_amount) FILTER (WHERE is_compare AND is_credit_memo)::text AS cm_sales_compare,
          COUNT(DISTINCT CASE WHEN is_base AND NOT is_credit_memo THEN sales_order_number END)::text AS so_count_base,
          COUNT(DISTINCT CASE WHEN is_compare AND NOT is_credit_memo THEN sales_order_number END)::text AS so_count_compare,
          COUNT(DISTINCT CASE WHEN is_base AND is_credit_memo THEN sales_order_number END)::text AS cm_count_base,
          COUNT(DISTINCT CASE WHEN is_compare AND is_credit_memo THEN sales_order_number END)::text AS cm_count_compare,
          SUM(weight) FILTER (WHERE is_base AND NOT is_credit_memo)::text AS weight_base,
          SUM(weight) FILTER (WHERE is_compare AND NOT is_credit_memo)::text AS weight_compare,
          array_agg(DISTINCT branch_id) FILTER (WHERE branch_id IS NOT NULL) AS branch_ids,
          COUNT(DISTINCT ship_to_id)::text AS ship_to_count
        FROM f
      `;

  const r = rows ?? {};

  const mkSet = (sfx: 'base' | 'compare'): KpiSet => ({
    sales: toNum((r as Record<string, unknown>)[`sales_${sfx}`]),
    gp: toNum((r as Record<string, unknown>)[`gp_${sfx}`]),
    vaSales: toNum((r as Record<string, unknown>)[`va_sales_${sfx}`]),
    nsSales: toNum((r as Record<string, unknown>)[`ns_sales_${sfx}`]),
    nsGp: toNum((r as Record<string, unknown>)[`ns_gp_${sfx}`]),
    grossSales: toNum((r as Record<string, unknown>)[`gross_sales_${sfx}`]),
    cmSales: toNum((r as Record<string, unknown>)[`cm_sales_${sfx}`]),
    soCount: toInt((r as Record<string, unknown>)[`so_count_${sfx}`]),
    cmCount: toInt((r as Record<string, unknown>)[`cm_count_${sfx}`]),
    totalWeight: toNum((r as Record<string, unknown>)[`weight_${sfx}`]),
  });

  return {
    base: mkSet('base'),
    compare: mkSet('compare'),
    branchIds: (r as Row).branch_ids ?? [],
    shipToCount: toInt((r as Row).ship_to_count) ?? 0,
    customerName: (r as Row).customer_name ?? params.customerId,
  };
}

// ---------------------------------------------------------------------------
// 3-year rolling comparison table
// ---------------------------------------------------------------------------

export async function fetchThreeYear(params: ScorecardParams): Promise<ThreeYearEntry[]> {
  const sql = getErpSql();
  const { baseCutoff } = getCutoffs(
    params.baseYear,
    params.compareYear,
    params.cutoffDate,
    params.period,
  );

  const prior1 = params.baseYear - 1;
  const prior2 = params.baseYear - 2;

  type Row = {
    cy_sales: string | null;
    cy_gp: string | null;
    py1_sales: string | null;
    py1_gp: string | null;
    py2_sales: string | null;
    py2_gp: string | null;
  };

  const [r] = params.branchIds.length > 0
    ? await sql<Row[]>`
        SELECT
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS cy_sales,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS cy_gp,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${prior1}
          )::text AS py1_sales,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${prior1}
          )::text AS py1_gp,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${prior2}
          )::text AS py2_sales,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${prior2}
          )::text AS py2_gp
        FROM customer_scorecard_fact
        WHERE is_deleted = false
          AND NOT is_sale_type_excluded
          AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${params.baseYear}, ${prior1}, ${prior2}]::int[])
          AND customer_id = ${params.customerId}
          AND branch_id = ANY(${params.branchIds}::text[])
      `
    : await sql<Row[]>`
        SELECT
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS cy_sales,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS cy_gp,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${prior1}
          )::text AS py1_sales,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${prior1}
          )::text AS py1_gp,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${prior2}
          )::text AS py2_sales,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${prior2}
          )::text AS py2_gp
        FROM customer_scorecard_fact
        WHERE is_deleted = false
          AND NOT is_sale_type_excluded
          AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${params.baseYear}, ${prior1}, ${prior2}]::int[])
          AND customer_id = ${params.customerId}
      `;

  const periodLabel = params.period === 'YTD'
    ? `YTD thru ${baseCutoff}`
    : 'Full Year';

  return [
    {
      year: params.baseYear,
      label: `${params.baseYear} ${periodLabel}`,
      sales: toNum(r?.cy_sales) ?? 0,
      gp: toNum(r?.cy_gp) ?? 0,
    },
    {
      year: prior1,
      label: `12/31/${prior1}`,
      sales: toNum(r?.py1_sales) ?? 0,
      gp: toNum(r?.py1_gp) ?? 0,
    },
    {
      year: prior2,
      label: `12/31/${prior2}`,
      sales: toNum(r?.py2_sales) ?? 0,
      gp: toNum(r?.py2_gp) ?? 0,
    },
  ];
}

// ---------------------------------------------------------------------------
// Product major breakdown
// ---------------------------------------------------------------------------

export async function fetchProductMajors(params: ScorecardParams): Promise<ProductMajorRow[]> {
  const sql = getErpSql();
  const { baseCutoff, compareCutoff } = getCutoffs(
    params.baseYear,
    params.compareYear,
    params.cutoffDate,
    params.period,
  );

  type Row = {
    product_major_code: string | null;
    product_major: string | null;
    sales_base: string | null;
    gp_base: string | null;
    sales_compare: string | null;
    gp_compare: string | null;
  };

  const rows = params.branchIds.length > 0
    ? await sql<Row[]>`
        SELECT
          COALESCE(product_major_code, '') AS product_major_code,
          COALESCE(product_major, 'Unknown') AS product_major,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS sales_base,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS gp_base,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS sales_compare,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS gp_compare
        FROM customer_scorecard_fact
        WHERE is_deleted = false
          AND NOT is_sale_type_excluded
          AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${params.baseYear}, ${params.compareYear}]::int[])
          AND customer_id = ${params.customerId}
          AND branch_id = ANY(${params.branchIds}::text[])
        GROUP BY product_major_code, product_major
        ORDER BY COALESCE(SUM(sales_amount) FILTER (
          WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
            AND invoice_date::date <= ${baseCutoff}::date
        ), 0) DESC
      `
    : await sql<Row[]>`
        SELECT
          COALESCE(product_major_code, '') AS product_major_code,
          COALESCE(product_major, 'Unknown') AS product_major,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS sales_base,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS gp_base,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS sales_compare,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS gp_compare
        FROM customer_scorecard_fact
        WHERE is_deleted = false
          AND NOT is_sale_type_excluded
          AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${params.baseYear}, ${params.compareYear}]::int[])
          AND customer_id = ${params.customerId}
        GROUP BY product_major_code, product_major
        ORDER BY COALESCE(SUM(sales_amount) FILTER (
          WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
            AND invoice_date::date <= ${baseCutoff}::date
        ), 0) DESC
      `;

  return rows.map((r) => ({
    productMajorCode: r.product_major_code ?? '',
    productMajor: r.product_major ?? 'Unknown',
    salesBase: toNum(r.sales_base) ?? 0,
    gpBase: toNum(r.gp_base) ?? 0,
    salesCompare: toNum(r.sales_compare) ?? 0,
    gpCompare: toNum(r.gp_compare) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Product minor drill-down (on demand)
// ---------------------------------------------------------------------------

export async function fetchProductMinors(
  params: ScorecardParams,
  majorCode: string,
): Promise<ProductMinorRow[]> {
  const sql = getErpSql();
  const { baseCutoff, compareCutoff } = getCutoffs(
    params.baseYear,
    params.compareYear,
    params.cutoffDate,
    params.period,
  );

  type Row = {
    product_minor_code: string | null;
    product_minor: string | null;
    sales_base: string | null;
    gp_base: string | null;
    sales_compare: string | null;
    gp_compare: string | null;
  };

  const rows = params.branchIds.length > 0
    ? await sql<Row[]>`
        SELECT
          COALESCE(product_minor_code, '') AS product_minor_code,
          COALESCE(product_minor, 'Unknown') AS product_minor,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS sales_base,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS gp_base,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS sales_compare,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS gp_compare
        FROM customer_scorecard_fact
        WHERE is_deleted = false
          AND NOT is_sale_type_excluded
          AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${params.baseYear}, ${params.compareYear}]::int[])
          AND customer_id = ${params.customerId}
          AND product_major_code = ${majorCode}
          AND branch_id = ANY(${params.branchIds}::text[])
        GROUP BY product_minor_code, product_minor
        ORDER BY COALESCE(SUM(sales_amount) FILTER (
          WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
            AND invoice_date::date <= ${baseCutoff}::date
        ), 0) DESC
      `
    : await sql<Row[]>`
        SELECT
          COALESCE(product_minor_code, '') AS product_minor_code,
          COALESCE(product_minor, 'Unknown') AS product_minor,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS sales_base,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS gp_base,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS sales_compare,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS gp_compare
        FROM customer_scorecard_fact
        WHERE is_deleted = false
          AND NOT is_sale_type_excluded
          AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${params.baseYear}, ${params.compareYear}]::int[])
          AND customer_id = ${params.customerId}
          AND product_major_code = ${majorCode}
        GROUP BY product_minor_code, product_minor
        ORDER BY COALESCE(SUM(sales_amount) FILTER (
          WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
            AND invoice_date::date <= ${baseCutoff}::date
        ), 0) DESC
      `;

  return rows.map((r) => ({
    productMinorCode: r.product_minor_code ?? '',
    productMinor: r.product_minor ?? 'Unknown',
    salesBase: toNum(r.sales_base) ?? 0,
    gpBase: toNum(r.gp_base) ?? 0,
    salesCompare: toNum(r.sales_compare) ?? 0,
    gpCompare: toNum(r.gp_compare) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Sale type breakdown
// ---------------------------------------------------------------------------

export async function fetchSaleTypes(params: ScorecardParams): Promise<SaleTypeRow[]> {
  const sql = getErpSql();
  const { baseCutoff, compareCutoff } = getCutoffs(
    params.baseYear,
    params.compareYear,
    params.cutoffDate,
    params.period,
  );

  type Row = {
    category: string | null;
    sales_base: string | null;
    gp_base: string | null;
    sales_compare: string | null;
    gp_compare: string | null;
  };

  const rows = params.branchIds.length > 0
    ? await sql<Row[]>`
        SELECT
          COALESCE(sale_type_reporting_category, 'Other') AS category,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS sales_base,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS gp_base,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS sales_compare,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS gp_compare
        FROM customer_scorecard_fact
        WHERE is_deleted = false
          AND NOT is_sale_type_excluded
          AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${params.baseYear}, ${params.compareYear}]::int[])
          AND customer_id = ${params.customerId}
          AND branch_id = ANY(${params.branchIds}::text[])
        GROUP BY sale_type_reporting_category
        ORDER BY COALESCE(SUM(sales_amount) FILTER (
          WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
            AND invoice_date::date <= ${baseCutoff}::date
        ), 0) DESC
      `
    : await sql<Row[]>`
        SELECT
          COALESCE(sale_type_reporting_category, 'Other') AS category,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS sales_base,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
              AND invoice_date::date <= ${baseCutoff}::date
          )::text AS gp_base,
          SUM(sales_amount) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS sales_compare,
          SUM(gross_profit) FILTER (
            WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.compareYear}
              AND invoice_date::date <= ${compareCutoff}::date
          )::text AS gp_compare
        FROM customer_scorecard_fact
        WHERE is_deleted = false
          AND NOT is_sale_type_excluded
          AND EXTRACT(YEAR FROM invoice_date) = ANY(ARRAY[${params.baseYear}, ${params.compareYear}]::int[])
          AND customer_id = ${params.customerId}
        GROUP BY sale_type_reporting_category
        ORDER BY COALESCE(SUM(sales_amount) FILTER (
          WHERE EXTRACT(YEAR FROM invoice_date)::int = ${params.baseYear}
            AND invoice_date::date <= ${baseCutoff}::date
        ), 0) DESC
      `;

  return rows.map((r) => ({
    category: r.category ?? 'Other',
    salesBase: toNum(r.sales_base) ?? 0,
    gpBase: toNum(r.gp_base) ?? 0,
    salesCompare: toNum(r.sales_compare) ?? 0,
    gpCompare: toNum(r.gp_compare) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Average days to pay
// ---------------------------------------------------------------------------

export async function fetchDaysToPay(params: ScorecardParams): Promise<DaysToPayData> {
  const sql = getErpSql();

  type Row = { avg_base: string | null; avg_compare: string | null };
  const [r] = await sql<Row[]>`
    SELECT
      AVG(days_to_pay) FILTER (
        WHERE EXTRACT(YEAR FROM COALESCE(payment_date, invoice_date))::int = ${params.baseYear}
      )::text AS avg_base,
      AVG(days_to_pay) FILTER (
        WHERE EXTRACT(YEAR FROM COALESCE(payment_date, invoice_date))::int = ${params.compareYear}
      )::text AS avg_compare
    FROM customer_payments
    WHERE is_deleted = false
      AND customer_id = ${params.customerId}
      AND EXTRACT(YEAR FROM COALESCE(payment_date, invoice_date))
          = ANY(ARRAY[${params.baseYear}, ${params.compareYear}]::int[])
  `;

  return {
    base: r?.avg_base != null ? Math.round(toNum(r.avg_base) ?? 0) : null,
    compare: r?.avg_compare != null ? Math.round(toNum(r.avg_compare) ?? 0) : null,
  };
}
