import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getErpSql } from '../../../../db/supabase';

export interface DeliveryRecord {
  so_number: string;
  system_id: string;
  customer_name: string;
  address: string;
  city: string | null;
  reference: string | null;
  so_status: string;
  shipment_status: string | null;
  invoice_date: string | null;
  expect_date: string | null;
  sale_type: string | null;
  route: string;
  ship_via: string;
  driver: string;
  status_flag_delivery: string | null;
  status_label: string;
}

// GET /api/delivery/tracker?branch=10FD&date=2026-04-02
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const branchParam = searchParams.get('branch') ?? '';
  const dateParam = searchParams.get('date') ?? new Date().toISOString().split('T')[0];

  const isAdmin =
    session.user.role === 'admin' ||
    (session.user.roles ?? []).some((r) => ['admin', 'supervisor', 'ops', 'dispatch'].includes(r));

  const effectiveBranch = isAdmin ? branchParam : (session.user.branch ?? '');

  function getStatusLabel(soStatus: string | null, shipStatus: string | null, delivStatus: string | null): string {
    const so = (soStatus ?? '').toUpperCase();
    const ship = (shipStatus ?? '').toUpperCase();
    const deliv = (delivStatus ?? '').toUpperCase();
    if (so === 'K') return 'PICKING';
    if (so === 'P') return 'PARTIAL';
    if (so === 'S') {
      if (deliv === 'E' || ship === 'E') return 'STAGED - EN ROUTE';
      if (deliv === 'L' || ship === 'L') return 'STAGED - LOADED';
      if (deliv === 'D' || ship === 'D') return 'STAGED - DELIVERED';
      return 'STAGED';
    }
    if (so === 'I') return 'INVOICED';
    return so || 'OPEN';
  }

  try {
    const sql = getErpSql();

    type RawRow = {
      so_id: string;
      system_id: string;
      cust_name: string | null;
      address_1: string | null;
      city: string | null;
      reference: string | null;
      so_status: string | null;
      shipment_status: string | null;
      invoice_date: string | null;
      expect_date: string | null;
      sale_type: string | null;
      route: string | null;
      ship_via: string | null;
      driver: string | null;
      status_flag_delivery: string | null;
    };

    const rows = await sql<RawRow[]>`
      SELECT
        soh.so_id::text AS so_id,
        soh.system_id,
        MAX(c.cust_name)   AS cust_name,
        MAX(cs.address_1)  AS address_1,
        MAX(cs.city)       AS city,
        MAX(soh.reference) AS reference,
        MAX(soh.so_status) AS so_status,
        MAX(sh.status_flag) AS shipment_status,
        MAX(sh.invoice_date)::text AS invoice_date,
        MAX(soh.expect_date)::text AS expect_date,
        MAX(soh.sale_type) AS sale_type,
        MAX(sh.route_id_char) AS route,
        MAX(COALESCE(sh.ship_via, soh.ship_via)) AS ship_via,
        MAX(sh.driver) AS driver,
        MAX(sh.status_flag_delivery) AS status_flag_delivery
      FROM erp_mirror_so_header soh
      LEFT JOIN erp_mirror_cust c
        ON TRIM(c.cust_key) = TRIM(soh.cust_key)
      LEFT JOIN erp_mirror_cust_shipto cs
        ON TRIM(cs.cust_key) = TRIM(soh.cust_key)
       AND TRIM(CAST(cs.seq_num AS TEXT)) = TRIM(CAST(soh.shipto_seq_num AS TEXT))
      LEFT JOIN erp_mirror_shipments_header sh
        ON sh.system_id = soh.system_id AND sh.so_id = soh.so_id
      WHERE soh.is_deleted = false
        AND UPPER(COALESCE(soh.so_status, '')) != 'C'
        ${effectiveBranch ? sql`AND soh.system_id = ${effectiveBranch}` : sql``}
        AND (
          CAST(soh.expect_date AS DATE) = ${dateParam}::date
          OR CAST(sh.ship_date AS DATE) = ${dateParam}::date
          OR (UPPER(COALESCE(soh.so_status, '')) = 'I' AND CAST(sh.invoice_date AS DATE) = ${dateParam}::date)
          OR (UPPER(COALESCE(soh.so_status, '')) IN ('K', 'P', 'S')
              AND CAST(soh.expect_date AS DATE) <= ${dateParam}::date)
        )
        AND UPPER(COALESCE(soh.sale_type, '')) NOT IN ('DIRECT', 'WILLCALL', 'XINSTALL', 'HOLD')
      GROUP BY soh.system_id, soh.so_id
      ORDER BY MAX(soh.so_id) DESC
    `;

    const deliveries: DeliveryRecord[] = rows.map((r) => ({
      so_number: r.so_id,
      system_id: r.system_id,
      customer_name: r.cust_name ?? 'Unknown',
      address: r.address_1 ? `${r.address_1}` : '',
      city: r.city,
      reference: r.reference,
      so_status: r.so_status ?? '',
      shipment_status: r.shipment_status,
      invoice_date: r.invoice_date,
      expect_date: r.expect_date,
      sale_type: r.sale_type,
      route: r.route ?? '',
      ship_via: r.ship_via ?? '',
      driver: r.driver ?? '',
      status_flag_delivery: r.status_flag_delivery,
      status_label: getStatusLabel(r.so_status, r.shipment_status, r.status_flag_delivery),
    }));

    return NextResponse.json({ deliveries, date: dateParam });
  } catch (err) {
    console.error('[delivery/tracker GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
