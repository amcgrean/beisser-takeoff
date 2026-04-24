import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getErpSql } from '../../../../db/supabase';
import { getSelectedBranchCode } from '@/lib/branch-context';
import {
  addParam,
  appendItemFilters,
  buildIlikeClause,
  buildItemSelect,
  buildSearchVector,
  getAgilityItemColumns,
  hasPrimarySupplierColumn,
  isProductAdmin,
  parseIncludeInactive,
} from './_shared';

type ProductRow = {
  item_number: string;
  description: string | null;
  short_description: string | null;
  extended_description: string | null;
  size: string | null;
  type: string | null;
  stocking_uom: string | null;
  handling_code: string | null;
  qty_on_hand: number | null;
  default_location: string | null;
  primary_supplier: string | null;
  system_id: string | null;
  active_flag: boolean | null;
  stock: boolean | null;
};

type CountRow = { total: number };
type SearchMode = 'fts' | 'ilike' | null;

// GET /api/sales/products?q=&group=<major_code>&major=<minor_code>&limit=50&offset=0
// Branch is read from the nav cookie (beisser-branch) for admins, session for non-admins.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';
  const majorCode = searchParams.get('group')?.trim() ?? '';  // product_major_code
  const minorCode = searchParams.get('major')?.trim() ?? '';  // product_minor_code
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);

  const isAdmin = isProductAdmin(session.user);
  const includeInactive = isAdmin && parseIncludeInactive(searchParams.get('includeInactive'));
  const effectiveBranch = isAdmin
    ? (await getSelectedBranchCode() ?? '')
    : (session.user.branch ?? '');

  const hasBrowseFilter = Boolean(majorCode);
  if (!hasBrowseFilter && q.length < 2) {
    return NextResponse.json({ products: [], total: 0 });
  }

  try {
    const sql = getErpSql();
    const columns = await getAgilityItemColumns(sql);
    const hasPriSupplier = hasPrimarySupplierColumn(columns);

    // Base WHERE for agility_items (active/stock/branch/deleted filters)
    const baseParams: unknown[] = [];
    const baseWhere: string[] = [];
    appendItemFilters(baseWhere, baseParams, effectiveBranch, includeInactive);

    // When browsing by major (and optionally minor), scope via scorecard subquery.
    // Values come from auth session / nav cookie so literal interpolation is safe.
    if (majorCode) {
      const esc = (s: string) => s.replace(/'/g, "''");
      const minorClause = minorCode ? ` AND product_minor_code = '${esc(minorCode)}'` : '';
      const branchClause = effectiveBranch ? ` AND branch_id = '${esc(effectiveBranch)}'` : '';
      baseWhere.push(
        `item IN (SELECT DISTINCT item_number FROM public.customer_scorecard_fact` +
        ` WHERE is_deleted = false AND product_major_code = '${esc(majorCode)}'${minorClause}${branchClause})`
      );
    }

    const runQuery = async (mode: SearchMode) => {
      const qParams = [...baseParams];
      const qWhere = [...baseWhere];

      if (q.length >= 2 && mode === 'fts') {
        qWhere.push(`${buildSearchVector(columns)} @@ websearch_to_tsquery('english', ${addParam(qParams, q)})`);
      } else if (q.length >= 2 && mode === 'ilike') {
        qWhere.push(buildIlikeClause(columns, addParam(qParams, `%${q}%`)));
      }

      const whereSql = qWhere.join(' AND ');

      const [countRows, rows] = await Promise.all([
        sql.unsafe(
          `SELECT count(*)::int AS total FROM public.agility_items WHERE ${whereSql}`,
          qParams as never[]
        ) as Promise<CountRow[]>,
        sql.unsafe(
          `${buildItemSelect(hasPriSupplier)} FROM public.agility_items WHERE ${whereSql} ORDER BY item, system_id LIMIT ${limit} OFFSET ${offset}`,
          qParams as never[]
        ) as Promise<ProductRow[]>,
      ]);

      return { products: rows, total: countRows[0]?.total ?? 0 };
    };

    let result = await runQuery(q.length >= 2 ? 'fts' : null);
    if (q.length >= 2 && result.total === 0) {
      result = await runQuery('ilike');
    }

    // TODO: cost from Agility API when pricing is exposed.
    return NextResponse.json({ products: result.products, total: result.total });
  } catch (err) {
    console.error('[sales/products GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
