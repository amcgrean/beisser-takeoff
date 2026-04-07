import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { getErpSql } from '../../../../../db/supabase';

type RouteContext = { params: Promise<{ po: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { po } = await context.params;
  const poNumber = po.trim().toUpperCase();

  try {
    const sql = getErpSql();

    const [headerRows, lineRows, receivingRows] = await Promise.all([
      sql`
        SELECT
          po_id AS po_number, supplier_name, supplier_code, system_id,
          expect_date::text AS expect_date, order_date::text AS order_date, po_status
        FROM agility_po_header
        WHERE po_id = ${poNumber} AND is_deleted = false
        LIMIT 1
      `,
      sql`
        SELECT
          pl.sequence,
          pl.item_code AS item_number,
          pl.description,
          pl.qty_ordered,
          pl.uom AS unit_of_measure,
          pl.cost AS unit_cost,
          COALESCE(rcv.qty_received, 0) AS qty_received
        FROM agility_po_lines pl
        LEFT JOIN (
          SELECT po_id, system_id, sequence, SUM(qty) AS qty_received
          FROM agility_receiving_lines
          WHERE is_deleted = false
          GROUP BY po_id, system_id, sequence
        ) rcv ON rcv.po_id = pl.po_id AND rcv.system_id = pl.system_id AND rcv.sequence = pl.sequence
        WHERE pl.po_id = ${poNumber} AND pl.is_deleted = false
        ORDER BY pl.sequence ASC NULLS LAST
      `,
      sql`
        SELECT
          COUNT(*)::int AS receipt_count,
          MAX(receive_date)::text AS last_received
        FROM agility_receiving_header
        WHERE po_id = ${poNumber} AND is_deleted = false
      `,
    ]);

    if (headerRows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      header: headerRows[0],
      lines: lineRows,
      receiving_summary: receivingRows[0] ?? null,
    });
  } catch (err) {
    console.error('[purchasing/pos/[po]]', err);
    return NextResponse.json({ error: 'ERP unavailable' }, { status: 503 });
  }
}
