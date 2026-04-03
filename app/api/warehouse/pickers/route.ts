import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getErpSql } from '../../../../db/supabase';

// GET  /api/warehouse/pickers       — list all pickers
// POST /api/warehouse/pickers       — add a picker { name, user_type }
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const sql = getErpSql();

    type PickerRow = { id: number; name: string; user_type: string | null };

    const rows = await sql<PickerRow[]>`
      SELECT id, name, user_type FROM pickster ORDER BY name
    `;

    return NextResponse.json({ pickers: rows });
  } catch (err) {
    console.error('[warehouse/pickers GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin =
    session.user.role === 'admin' ||
    (session.user.roles ?? []).some((r) => ['admin', 'supervisor'].includes(r));
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { name?: string; user_type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const user_type = (body.user_type ?? '').trim() || null;

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  try {
    const sql = getErpSql();

    type NewRow = { id: number; name: string; user_type: string | null };
    const rows = await sql<NewRow[]>`
      INSERT INTO pickster (name, user_type) VALUES (${name}, ${user_type}) RETURNING id, name, user_type
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('[warehouse/pickers POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
