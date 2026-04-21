import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { getErpSql } from '../../../db/supabase';

// GET /api/credits?page=1&rma=&q=
// Default (no search): paginated list of open credits joined to agility_ar_open.
// Search mode (rma or q param): grouped by RMA, up to 200 rows.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const rma = (searchParams.get('rma') ?? '').trim();
  const q   = (searchParams.get('q')   ?? '').trim();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const PAGE_SIZE = 25;
  const offset = (page - 1) * PAGE_SIZE;

  const isSearch = rma.length > 0 || q.length >= 2;

  try {
    const sql = getErpSql();

    type Row = {
      id: number; rma_number: string; filename: string; filepath: string;
      email_from: string | null; email_subject: string | null;
      received_at: string | null; uploaded_at: string | null;
      r2_key: string | null;
    };

    if (isSearch) {
      const rows = rma
        ? await sql<Row[]>`
            SELECT ci.id, ci.rma_number, ci.filename, ci.filepath,
                   ci.email_from, ci.email_subject,
                   ci.received_at::text, ci.uploaded_at::text, ci.r2_key
            FROM credit_images ci
            INNER JOIN agility_ar_open ar
              ON ci.rma_number = ar.ref_num
              AND ar.open_flag = true
              AND ar.is_deleted = false
            WHERE ci.rma_number ILIKE ${rma + '%'}
            ORDER BY ci.received_at DESC
            LIMIT 200
          `
        : await sql<Row[]>`
            SELECT ci.id, ci.rma_number, ci.filename, ci.filepath,
                   ci.email_from, ci.email_subject,
                   ci.received_at::text, ci.uploaded_at::text, ci.r2_key
            FROM credit_images ci
            INNER JOIN agility_ar_open ar
              ON ci.rma_number = ar.ref_num
              AND ar.open_flag = true
              AND ar.is_deleted = false
            WHERE ci.rma_number ILIKE ${'%' + q + '%'}
               OR ci.email_from ILIKE ${'%' + q + '%'}
               OR ci.email_subject ILIKE ${'%' + q + '%'}
            ORDER BY ci.received_at DESC
            LIMIT 200
          `;

      const grouped = rows.reduce<Record<string, { rma_number: string; images: Row[] }>>((acc, row) => {
        if (!acc[row.rma_number]) acc[row.rma_number] = { rma_number: row.rma_number, images: [] };
        acc[row.rma_number].images.push(row);
        return acc;
      }, {});

      return NextResponse.json({
        mode: 'search',
        credits: Object.values(grouped),
        total: rows.length,
      });
    }

    // Default: paginated flat list of open credits
    const [rows, countResult] = await Promise.all([
      sql<Row[]>`
        SELECT ci.id, ci.rma_number, ci.filename, ci.filepath,
               ci.email_from, ci.email_subject,
               ci.received_at::text, ci.uploaded_at::text, ci.r2_key
        FROM credit_images ci
        INNER JOIN agility_ar_open ar
          ON ci.rma_number = ar.ref_num
          AND ar.open_flag = true
          AND ar.is_deleted = false
        ORDER BY ci.received_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `,
      sql<[{ count: string }]>`
        SELECT COUNT(*) AS count
        FROM credit_images ci
        INNER JOIN agility_ar_open ar
          ON ci.rma_number = ar.ref_num
          AND ar.open_flag = true
          AND ar.is_deleted = false
      `,
    ]);

    const total = parseInt(countResult[0]?.count ?? '0', 10);

    return NextResponse.json({
      mode: 'list',
      rows,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    console.error('[credits GET]', err);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}
