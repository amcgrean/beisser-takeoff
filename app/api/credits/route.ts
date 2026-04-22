import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { getErpSql } from '../../../db/supabase';

// GET /api/credits?page=1&branch=&rma=&q=
// Drives from agility_so_header WHERE sale_type='CM' AND not-yet-invoiced,
// filtered by user's branch. LEFT JOINs credit_images for doc counts.
// Search mode (rma or q): filters within the same CM set.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const isAdmin      = (session.user as { role?: string }).role === 'admin';
  const branchParam  = searchParams.get('branch') ?? '';
  const branch       = isAdmin ? branchParam : (session.user.branch ?? '');
  const rma          = (searchParams.get('rma') ?? '').trim();
  const q            = (searchParams.get('q')   ?? '').trim();
  const page         = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const PAGE_SIZE    = 25;
  const offset       = (page - 1) * PAGE_SIZE;

  const isSearch = rma.length > 0 || q.length >= 2;

  try {
    const sql = getErpSql();

    type CmRow = {
      so_id: string;
      cust_name: string | null;
      cust_code: string | null;
      so_status: string | null;
      system_id: string | null;
      doc_count: string;
      latest_doc_received: string | null;
    };

    const baseWhere = sql`
      soh.sale_type = 'CM'
      AND UPPER(COALESCE(soh.so_status, '')) NOT IN ('I', 'C')
      AND soh.is_deleted = false
      ${branch ? sql`AND soh.system_id = ${branch}` : sql``}
    `;

    const searchFilter = isSearch
      ? rma.length > 0
        ? sql`AND soh.so_id::text ILIKE ${rma + '%'}`
        : sql`AND (soh.so_id::text ILIKE ${'%' + q + '%'} OR soh.cust_name ILIKE ${'%' + q + '%'})`
      : sql``;

    const rows = await sql<CmRow[]>`
      SELECT
        soh.so_id::text          AS so_id,
        soh.cust_name,
        soh.cust_code,
        soh.so_status,
        soh.system_id,
        COUNT(ci.id)::text       AS doc_count,
        MAX(ci.received_at)::text AS latest_doc_received
      FROM agility_so_header soh
      LEFT JOIN credit_images ci ON ci.rma_number = soh.so_id::text
      WHERE ${baseWhere} ${searchFilter}
      GROUP BY soh.so_id, soh.cust_name, soh.cust_code, soh.so_status, soh.system_id
      ORDER BY soh.so_id DESC
      LIMIT ${isSearch ? 200 : PAGE_SIZE} OFFSET ${isSearch ? 0 : offset}
    `;

    if (isSearch) {
      return NextResponse.json({ mode: 'search', rows, total: rows.length });
    }

    const countResult = await sql<[{ count: string }]>`
      SELECT COUNT(DISTINCT soh.so_id)::text AS count
      FROM agility_so_header soh
      WHERE ${baseWhere}
    `;
    const total = parseInt(countResult[0]?.count ?? '0', 10);

    return NextResponse.json({
      mode: 'list',
      rows,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
      branch,
    });
  } catch (err) {
    console.error('[credits GET]', err);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}
