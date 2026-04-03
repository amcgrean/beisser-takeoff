import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { getDb } from '../../../db/index';
import { sql } from 'drizzle-orm';

// POST /api/track-visit
// Body: { path: string }
// Upserts visit count for the current user + path.
// Silently no-ops if table doesn't exist yet.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false });

  try {
    const { path } = await req.json() as { path?: string };
    if (!path || typeof path !== 'string' || path.length > 500) {
      return NextResponse.json({ ok: false });
    }

    // Normalize: strip query string + trailing slash
    const clean = path.split('?')[0].replace(/\/$/, '') || '/';

    const db = getDb();
    await db.execute(sql`
      INSERT INTO bids.page_visits (user_id, path, visit_count, last_visited_at)
      VALUES (${session.user.id}, ${clean}, 1, NOW())
      ON CONFLICT (user_id, path)
      DO UPDATE SET
        visit_count     = bids.page_visits.visit_count + 1,
        last_visited_at = NOW()
    `);
  } catch {
    // Table not yet created — silently ignore
  }

  return NextResponse.json({ ok: true });
}
