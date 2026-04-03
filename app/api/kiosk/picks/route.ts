import { NextRequest, NextResponse } from 'next/server';
import { getErpSql } from '../../../../db/supabase';

// GET /api/kiosk/picks?picker_id=5  — incomplete picks for a picker
// POST /api/kiosk/picks              — complete a pick by id
// No auth — kiosk devices are trusted in-store

export async function GET(req: NextRequest) {
  const pickerId = req.nextUrl.searchParams.get('picker_id');
  if (!pickerId) return NextResponse.json({ error: 'picker_id required' }, { status: 400 });

  const sql = getErpSql();
  const rows = await sql`
    SELECT p.id, p.barcode_number, p.shipment_num, p.start_time::text,
           p.pick_type_id, pt.type_name AS pick_type_name, p.notes
    FROM pick p
    LEFT JOIN pick_types pt ON pt.pick_type_id = p.pick_type_id
    WHERE p.picker_id = ${parseInt(pickerId, 10)}
      AND p.completed_time IS NULL
    ORDER BY p.start_time DESC
  `;
  return NextResponse.json({ picks: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { pick_id?: number; picker_id?: number };
  const { pick_id, picker_id } = body;
  if (!pick_id) return NextResponse.json({ error: 'pick_id required' }, { status: 400 });

  const sql = getErpSql();
  const now = new Date();

  const rows = await sql`
    UPDATE pick SET completed_time = ${now}
    WHERE id = ${pick_id} AND completed_time IS NULL
    RETURNING id, barcode_number
  `;

  if (!rows[0]) return NextResponse.json({ error: 'Pick not found or already complete' }, { status: 404 });
  const pick = rows[0] as { id: number; barcode_number: string };

  await sql`
    INSERT INTO audit_events (event_type, entity_type, entity_id, so_number, actor_id, occurred_at)
    VALUES ('pick_completed', 'pick', ${pick.id}, ${pick.barcode_number}, ${picker_id ?? null}, ${now})
  `;

  return NextResponse.json({ ok: true, pick_id: pick.id });
}
