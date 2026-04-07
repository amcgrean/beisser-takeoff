import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // app_po_header matview not present — purchasing routes now query agility_* tables directly
  return NextResponse.json({ ok: true });
}
