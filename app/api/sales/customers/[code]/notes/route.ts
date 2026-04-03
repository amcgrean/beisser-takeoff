import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../../auth';
import { getErpSql } from '../../../../../../db/supabase';

type RouteContext = { params: Promise<{ code: string }> };

// GET /api/sales/customers/:code/notes
export async function GET(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = await ctx.params;
  const cust = code.trim().toUpperCase();

  try {
    const sql = getErpSql();
    const rows = await sql<{
      id: number; note_type: string | null; body: string;
      rep_name: string | null; created_at: string | null;
    }[]>`
      SELECT id, note_type, body, rep_name, created_at::text
      FROM customer_notes
      WHERE customer_number = ${cust}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    return NextResponse.json({ notes: rows });
  } catch (err) {
    console.error('[sales/customers/[code]/notes GET]', err);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}

// POST /api/sales/customers/:code/notes
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = await ctx.params;
  const cust = code.trim().toUpperCase();

  const body = await req.json().catch(() => null);
  const noteBody = (body?.body ?? '').trim();
  const noteType = (body?.note_type ?? 'Call').trim() || 'Call';
  const repName = (body?.rep_name ?? session.user.name ?? '').trim();

  if (!noteBody) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 });
  }

  try {
    const sql = getErpSql();
    const rows = await sql<{ id: number; created_at: string }[]>`
      INSERT INTO customer_notes (customer_number, note_type, body, rep_name, created_at)
      VALUES (${cust}, ${noteType}, ${noteBody}, ${repName || null}, NOW())
      RETURNING id, created_at::text
    `;
    return NextResponse.json(
      { id: rows[0].id, customer_number: cust, note_type: noteType, body: noteBody, rep_name: repName, created_at: rows[0].created_at },
      { status: 201 }
    );
  } catch (err) {
    console.error('[sales/customers/[code]/notes POST]', err);
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }
}
