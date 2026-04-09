import { NextRequest, NextResponse } from 'next/server';
import { getErpSql } from '../../../../db/supabase';

// GET /api/kiosk/pickers?branch=20GR  — pickers for a branch (kiosk, no auth)
// No auth — kiosk devices are trusted in-store

export async function GET(req: NextRequest) {
  const branch = req.nextUrl.searchParams.get('branch');
  if (!branch) return NextResponse.json({ error: 'branch required' }, { status: 400 });

  try {
    const sql = getErpSql();

    type PickerRow = { id: number; name: string; user_type: string | null; branch_code: string | null };

    const rows = await sql<PickerRow[]>`
      SELECT id, name, user_type, branch_code
      FROM pickster
      WHERE branch_code = ${branch}
      ORDER BY name
    `;

    return NextResponse.json({ pickers: rows });
  } catch (err) {
    console.error('[kiosk/pickers GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
