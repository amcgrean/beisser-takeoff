import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';

// GET /api/delivery/locations?branch=20GR
// Thin proxy to /api/dispatch/vehicles — returns vehicle GPS for map display.
// This matches the WH-Tracker /api/delivery/locations endpoint pattern.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const branch = req.nextUrl.searchParams.get('branch') ?? '';

  // Delegate to the existing dispatch/vehicles endpoint
  const url = new URL('/api/dispatch/vehicles', req.nextUrl.origin);
  if (branch) url.searchParams.set('branch', branch);

  try {
    const res = await fetch(url.toString(), {
      headers: { cookie: req.headers.get('cookie') ?? '' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[delivery/locations GET]', err);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}
