import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { getDb } from '../../../../../db/index';
import { getErpSql } from '../../../../../db/supabase';
import { hubbellEmails } from '../../../../../db/schema';
import { and, isNotNull, inArray } from 'drizzle-orm';

// GET /api/admin/hubbell/jobs
// All unique job sites (SOs with confirmed emails), newest first.
// Uses two separate queries (bids DB + ERP DB) to avoid cross-schema permission issues.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as { role?: string }).role ?? '';
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getDb();

  // Step 1: Pull all confirmed emails from bids DB
  const confirmedEmails = await db
    .select({
      confirmedSoId:   hubbellEmails.confirmedSoId,
      emailType:       hubbellEmails.emailType,
      extractedAmount: hubbellEmails.extractedAmount,
      receivedAt:      hubbellEmails.receivedAt,
    })
    .from(hubbellEmails)
    .where(and(
      isNotNull(hubbellEmails.confirmedSoId),
      inArray(hubbellEmails.matchStatus, ['confirmed', 'matched']),
    ));

  if (confirmedEmails.length === 0) return NextResponse.json({ jobs: [] });

  // Step 2: Aggregate per SO in JS
  type Stats = { emailCount: number; poCount: number; woCount: number; totalAmount: number; lastReceived: Date };
  const statsMap = new Map<string, Stats>();

  for (const email of confirmedEmails) {
    const soId = email.confirmedSoId!;
    const s = statsMap.get(soId) ?? { emailCount: 0, poCount: 0, woCount: 0, totalAmount: 0, lastReceived: new Date(0) };
    s.emailCount++;
    if (email.emailType === 'po') s.poCount++;
    if (email.emailType === 'wo') s.woCount++;
    s.totalAmount += parseFloat(email.extractedAmount ?? '0') || 0;
    const recv = email.receivedAt ? new Date(String(email.receivedAt)) : new Date(0);
    if (recv > s.lastReceived) s.lastReceived = recv;
    statsMap.set(soId, s);
  }

  // Sort by most recent email first
  const soIds = [...statsMap.entries()]
    .sort((a, b) => b[1].lastReceived.getTime() - a[1].lastReceived.getTime())
    .map(([id]) => id);

  // Step 3: Fetch SO details from ERP
  const erpSql = getErpSql();

  type SoRow = {
    so_id: string;
    cust_code: string | null;
    cust_name: string | null;
    so_status: string | null;
    sale_type: string | null;
    shipto_address_1: string | null;
    shipto_city: string | null;
    shipto_state: string | null;
    shipto_zip: string | null;
  };

  const soHeaders = await erpSql<SoRow[]>`
    SELECT
      so_id::text,
      TRIM(cust_code)  AS cust_code,
      cust_name,
      so_status,
      sale_type,
      shipto_address_1,
      shipto_city,
      shipto_state,
      shipto_zip
    FROM agility_so_header
    WHERE so_id::text = ANY(${soIds})
      AND is_deleted = false
  `;

  const soMap = new Map(soHeaders.map((r) => [r.so_id, r]));

  // Merge, preserving sort order
  const jobs = soIds
    .map((soId) => {
      const so = soMap.get(soId);
      const s  = statsMap.get(soId)!;
      if (!so) return null;
      return {
        so_id:            soId,
        cust_code:        so.cust_code,
        cust_name:        so.cust_name,
        so_status:        so.so_status,
        sale_type:        so.sale_type,
        shipto_address_1: so.shipto_address_1,
        shipto_city:      so.shipto_city,
        shipto_state:     so.shipto_state,
        shipto_zip:       so.shipto_zip,
        email_count:      String(s.emailCount),
        po_count:         String(s.poCount),
        wo_count:         String(s.woCount),
        total_amount:     String(s.totalAmount),
        last_received:    s.lastReceived.toISOString(),
      };
    })
    .filter(Boolean);

  return NextResponse.json({ jobs });
}
