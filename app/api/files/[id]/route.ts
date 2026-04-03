import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getDb } from '../../../../db/index';
import { getPresignedPdfUrl, deletePdf } from '@/lib/r2';
import { sql } from 'drizzle-orm';

// GET /api/files/[id] — get presigned download URL
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const db = getDb();
    const rows = await db.execute(
      sql`SELECT id::text, file_name, r2_key, content_type FROM bids.files WHERE id = ${id}::uuid`
    );

    if (!rows.rows[0]) return NextResponse.json({ error: 'File not found.' }, { status: 404 });

    const file = rows.rows[0] as { id: string; file_name: string; r2_key: string; content_type: string };
    const url = await getPresignedPdfUrl(file.r2_key);

    return NextResponse.json({ url, file_name: file.file_name, content_type: file.content_type });
  } catch (err) {
    console.error('[api/files GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/files/[id] — delete file record + R2 object
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const db = getDb();

    // Fetch before deleting so we can check ownership
    const lookup = await db.execute(
      sql`SELECT id::text, r2_key, uploaded_by FROM bids.files WHERE id = ${id}::uuid`
    );
    if (!lookup.rows[0]) return NextResponse.json({ error: 'File not found.' }, { status: 404 });

    const file = lookup.rows[0] as { id: string; r2_key: string; uploaded_by: number | null };

    const isAdmin = session.user.role === 'admin';
    const isOwner = file.uploaded_by != null && String(file.uploaded_by) === String(session.user.id);
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    await db.execute(sql`DELETE FROM bids.files WHERE id = ${id}::uuid`);
    try { await deletePdf(file.r2_key); } catch { /* R2 object may already be gone */ }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/files DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
