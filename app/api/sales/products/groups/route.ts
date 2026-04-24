import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { getErpSql } from '../../../../../db/supabase';
import { getSelectedBranchCode } from '@/lib/branch-context';
import { formatProductLabel, isProductAdmin } from '../_shared';

type MajorRow = {
  code: string;
  label: string | null;
  item_count: number;
};

// GET /api/sales/products/groups
// Returns distinct product majors from customer_scorecard_fact, scoped to the
// branch selected in the nav (beisser-branch cookie) for admins.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = isProductAdmin(session.user);
  const effectiveBranch = isAdmin
    ? (await getSelectedBranchCode() ?? '')
    : (session.user.branch ?? '');

  try {
    const sql = getErpSql();

    const params: unknown[] = [];
    const where: string[] = ['is_deleted = false', `NULLIF(product_major_code, '') IS NOT NULL`];
    if (effectiveBranch) {
      where.push(`branch_id = $${params.push(effectiveBranch)}`);
    }

    const rows = (await sql.unsafe(
      `SELECT product_major_code AS code,
              MAX(COALESCE(NULLIF(product_major, ''), product_major_code)) AS label,
              COUNT(DISTINCT item_number)::int AS item_count
       FROM public.customer_scorecard_fact
       WHERE ${where.join(' AND ')}
       GROUP BY product_major_code
       ORDER BY MAX(COALESCE(NULLIF(product_major, ''), product_major_code))`,
      params as never[]
    )) as MajorRow[];

    return NextResponse.json({
      groups: rows.map((r) => ({
        code: r.code,
        label: formatProductLabel(r.label ?? r.code),
        item_count: r.item_count,
      })),
      // Always two browseable levels: major → minor → items
      supportsMajor: true,
      supportsMinor: false,
    });
  } catch (err) {
    console.error('[sales/products/groups GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
