import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { getErpSql } from '../../../../../db/supabase';

// GET /api/admin/hubbell/jobs
// All unique job sites (SOs with confirmed emails), newest first.
// Cross-schema query: bids.hubbell_emails ⋈ public.agility_so_header.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as { role?: string }).role ?? '';
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const erpSql = getErpSql();

  type JobRow = {
    so_id: string;
    cust_code: string | null;
    cust_name: string | null;
    so_status: string | null;
    sale_type: string | null;
    shipto_address_1: string | null;
    shipto_city: string | null;
    shipto_state: string | null;
    shipto_zip: string | null;
    email_count: string;
    po_count: string;
    wo_count: string;
    total_amount: string;
    last_received: string;
  };

  const jobs = await erpSql<JobRow[]>`
    SELECT
      soh.so_id::text,
      TRIM(soh.cust_code)   AS cust_code,
      soh.cust_name,
      soh.so_status,
      soh.sale_type,
      soh.shipto_address_1,
      soh.shipto_city,
      soh.shipto_state,
      soh.shipto_zip,
      ec.email_count,
      ec.po_count,
      ec.wo_count,
      ec.total_amount,
      ec.last_received
    FROM agility_so_header soh
    JOIN (
      SELECT
        confirmed_so_id,
        COUNT(*)::text                                       AS email_count,
        COUNT(CASE WHEN email_type = 'po' THEN 1 END)::text AS po_count,
        COUNT(CASE WHEN email_type = 'wo' THEN 1 END)::text AS wo_count,
        COALESCE(SUM(extracted_amount::numeric), 0)::text   AS total_amount,
        MAX(received_at)                                     AS last_received
      FROM bids.hubbell_emails
      WHERE confirmed_so_id IS NOT NULL
        AND match_status IN ('confirmed', 'matched')
      GROUP BY confirmed_so_id
    ) ec ON ec.confirmed_so_id = soh.so_id::text
    WHERE soh.is_deleted = false
    ORDER BY ec.last_received DESC
  `;

  return NextResponse.json({ jobs });
}
