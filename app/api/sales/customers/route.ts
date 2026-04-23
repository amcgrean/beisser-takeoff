import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getErpSql } from '../../../../db/supabase';

// GET /api/sales/customers?q=&limit=50
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = (searchParams.get('q') ?? '').trim();
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10) || 50);

  try {
    const sql = getErpSql();

    type Row = {
      cust_code: string;
      cust_name: string | null;
      salesperson: string | null;
    };

    const rows = await sql<Row[]>`
      WITH cust AS (
        SELECT cust_code, MAX(cust_name) AS cust_name
        FROM agility_customers
        WHERE is_deleted = false
          ${q ? sql`AND (cust_code ILIKE ${'%' + q + '%'} OR cust_name ILIKE ${'%' + q + '%'})` : sql``}
        GROUP BY cust_code
        ORDER BY MAX(cust_name) ASC NULLS LAST
        LIMIT ${limit}
      )
      SELECT c.cust_code, c.cust_name, rep.salesperson
      FROM cust c
      LEFT JOIN LATERAL (
        SELECT UPPER(TRIM(salesperson)) AS salesperson
        FROM agility_so_header
        WHERE TRIM(cust_code) = TRIM(c.cust_code)
          AND is_deleted = false
          AND salesperson IS NOT NULL
          AND TRIM(salesperson) <> ''
        ORDER BY created_date DESC NULLS LAST
        LIMIT 1
      ) rep ON true
      ORDER BY c.cust_name ASC NULLS LAST
    `;

    return NextResponse.json({ customers: rows });
  } catch (err) {
    console.error('[sales/customers GET]', err);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}
