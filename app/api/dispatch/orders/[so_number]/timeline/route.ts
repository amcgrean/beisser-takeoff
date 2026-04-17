import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../../auth';
import { getErpSql } from '../../../../../../db/supabase';

// GET /api/dispatch/orders/[so_number]/timeline
// Returns pick, staging, loading, and shipment timestamps for a single SO
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ so_number: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { so_number } = await params;
  if (!so_number) return NextResponse.json({ error: 'so_number required' }, { status: 400 });

  const soNum = parseInt(so_number, 10);
  if (isNaN(soNum)) return NextResponse.json({ error: 'Invalid SO number' }, { status: 400 });

  try {
    const sql = getErpSql();

    type SoRow = {
      so_id: string;
      system_id: string;
      so_status: string | null;
      cust_code: string | null;
      cust_name: string | null;
      reference: string | null;
      sale_type: string | null;
      expect_date: string | null;
      shipto_address_1: string | null;
      shipto_city: string | null;
      shipto_state: string | null;
    };

    type PickRow = {
      pick_id: number;
      sequence: number | null;
      print_status: string | null;
      created_date: string | null;
    };

    type ShipmentRow = {
      shipment_num: number;
      status_flag: string | null;
      ship_date: string | null;
      loaded_date: string | null;
      loaded_time: string | null;
      route_id_char: string | null;
      driver: string | null;
      invoice_date: string | null;
    };

    const [soRows, pickRows, shipmentRows] = await Promise.all([
      sql<SoRow[]>`
        SELECT so_id, system_id, so_status, cust_code, cust_name, reference,
               sale_type, expect_date::text,
               shipto_address_1, shipto_city, shipto_state
        FROM agility_so_header
        WHERE so_id = ${so_number} AND is_deleted = false
        LIMIT 1
      `,
      sql<PickRow[]>`
        SELECT pick_id, sequence, print_status, created_date::text
        FROM agility_picks
        WHERE tran_type = 'SO' AND tran_id = ${soNum} AND is_deleted = false
        ORDER BY created_date ASC
        LIMIT 20
      `,
      sql<ShipmentRow[]>`
        SELECT shipment_num, status_flag, ship_date::text, loaded_date::text,
               loaded_time, route_id_char, driver, invoice_date::text
        FROM agility_shipments
        WHERE so_id = ${so_number} AND is_deleted = false
        ORDER BY shipment_num
        LIMIT 5
      `,
    ]);

    if (!soRows.length) {
      return NextResponse.json({ error: 'SO not found' }, { status: 404 });
    }

    const so = soRows[0];

    // Build timeline events
    const events: { label: string; time: string | null; detail?: string }[] = [];

    // Pick events
    if (pickRows.length > 0) {
      const first = pickRows[0];
      events.push({
        label: 'Pick Ticket Created',
        time: first.created_date,
        detail: `${pickRows.length} ticket${pickRows.length !== 1 ? 's' : ''} · Status: ${first.print_status ?? '—'}`,
      });
    }

    // Shipment events
    for (const sh of shipmentRows) {
      if (sh.loaded_date) {
        events.push({
          label: `Loaded${sh.shipment_num > 1 ? ` (Ship #${sh.shipment_num})` : ''}`,
          time: sh.loaded_date,
          detail: [sh.loaded_time?.trim(), sh.driver?.trim(), sh.route_id_char?.trim()]
            .filter(Boolean).join(' · ') || undefined,
        });
      }
      if (sh.ship_date) {
        events.push({
          label: `Shipped${sh.shipment_num > 1 ? ` (Ship #${sh.shipment_num})` : ''}`,
          time: sh.ship_date,
          detail: sh.status_flag ?? undefined,
        });
      }
      if (sh.invoice_date) {
        events.push({
          label: `Invoiced${sh.shipment_num > 1 ? ` (Ship #${sh.shipment_num})` : ''}`,
          time: sh.invoice_date,
        });
      }
    }

    // Sort by time ascending
    events.sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return new Date(a.time).getTime() - new Date(b.time).getTime();
    });

    return NextResponse.json({
      so,
      picks: pickRows,
      shipments: shipmentRows,
      events,
    });
  } catch (err) {
    console.error('[dispatch/orders/timeline GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
