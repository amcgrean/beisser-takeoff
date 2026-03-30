import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '../../../db/index';

// Temporary debug route — remove after login is working
export async function GET() {
  try {
    const db = getDb();
    const result = await db.execute(
      sql`SELECT id, username, email, is_active, is_admin, is_estimator FROM "user" LIMIT 3`
    );
    return NextResponse.json({
      type: typeof result,
      isArray: Array.isArray(result),
      keys: result ? Object.keys(result) : null,
      data: JSON.parse(JSON.stringify(result)),
    });
  } catch (err) {
    return NextResponse.json({
      error: String(err),
      message: err instanceof Error ? err.message : 'unknown',
    }, { status: 500 });
  }
}
