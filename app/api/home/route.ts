import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { getDb } from '../../../db/index';
import { getErpSql, isErpConfigured } from '../../../db/supabase';
import { legacyBid, legacyDesign, legacyBidActivity } from '../../../db/schema-legacy';
import { eq, sql, and, desc } from 'drizzle-orm';

export interface HomeKPIs {
  openBids: number;
  openDesigns: number;
  openPicks: number;
  openWorkOrders: number;
  openOrders: number;
}

export interface ActivityItem {
  id: number;
  bidId: number;
  action: string;
  timestamp: string;
  href: string;
}

export interface TopPage {
  path: string;
  label: string;
  visit_count: number;
}

export interface HomeData {
  kpis: HomeKPIs;
  recentActivity: ActivityItem[];
  topPages: TopPage[];
}

// Friendly labels for top pages
function pathLabel(path: string): string {
  const map: Record<string, string> = {
    '/warehouse': 'Picks Board',
    '/warehouse/open-picks': 'Open Picks',
    '/warehouse/picker-stats': 'Picker Stats',
    '/work-orders': 'Work Orders',
    '/dispatch': 'Dispatch Board',
    '/delivery': 'Delivery Tracker',
    '/sales': 'Sales Hub',
    '/sales/transactions': 'Transactions',
    '/sales/customers': 'Customers',
    '/sales/history': 'Purchase History',
    '/sales/products': 'Products & Stock',
    '/legacy-bids': 'Bids',
    '/takeoff': 'PDF Takeoff',
    '/estimating': 'Estimating App',
    '/ewp': 'EWP',
    '/projects': 'Projects',
    '/designs': 'Designs',
    '/it-issues': 'IT Issues',
    '/purchasing': 'PO Check-In',
    '/purchasing/open-pos': 'Open POs',
    '/purchasing/review': 'Review Queue',
    '/purchasing/workspace': 'Buyer Workspace',
    '/credits': 'RMA Credits',
  };
  return map[path] ?? path.replace(/^\//, '').replace(/\//g, ' › ');
}

// GET /api/home
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id ?? '';

  const kpis: HomeKPIs = {
    openBids: 0,
    openDesigns: 0,
    openPicks: 0,
    openWorkOrders: 0,
    openOrders: 0,
  };
  let recentActivity: ActivityItem[] = [];
  let topPages: TopPage[] = [];

  try {
    const db = getDb();

    // Open bids
    const [bidsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(legacyBid)
      .where(eq(legacyBid.status, 'Incomplete'));
    kpis.openBids = bidsRes?.count ?? 0;

    // Open designs
    const [designsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(legacyDesign)
      .where(eq(legacyDesign.status, 'Active'));
    kpis.openDesigns = designsRes?.count ?? 0;

    // Recent bid activity (last 10)
    const activity = await db
      .select({
        id: legacyBidActivity.id,
        bidId: legacyBidActivity.bidId,
        action: legacyBidActivity.action,
        timestamp: legacyBidActivity.timestamp,
      })
      .from(legacyBidActivity)
      .orderBy(desc(legacyBidActivity.timestamp))
      .limit(10);

    recentActivity = activity.map((a) => ({
      id: a.id,
      bidId: a.bidId,
      action: a.action ?? '',
      timestamp: a.timestamp?.toISOString() ?? '',
      href: `/legacy-bids/${a.bidId}`,
    }));

    // Top pages from page_visits (table may not exist yet — handle gracefully)
    try {
      const pagesRes = await db.execute(
        sql`SELECT path, visit_count FROM bids.page_visits WHERE user_id = ${userId} ORDER BY visit_count DESC LIMIT 6`
      );
      topPages = (pagesRes as unknown as { path: string; visit_count: number }[]).map((r) => ({
        path: r.path,
        label: pathLabel(r.path),
        visit_count: r.visit_count,
      }));
    } catch {
      // Table doesn't exist yet — no-op
    }
  } catch (err) {
    console.error('[api/home bids]', err);
  }

  // ERP KPIs (non-fatal if ERP not configured)
  if (isErpConfigured()) {
    try {
      const erpSql = getErpSql();

      // Open picks: count distinct SOs in K/P/S status (by order, not by line)
      const [picksRes] = await erpSql<{ cnt: number }[]>`
        SELECT COUNT(DISTINCT soh.so_id)::int AS cnt
        FROM agility_so_header soh
        LEFT JOIN (
          SELECT system_id, so_id, MAX(invoice_date::date) AS invoice_date
          FROM agility_shipments
          WHERE is_deleted = false
          GROUP BY system_id, so_id
        ) sh ON sh.system_id = soh.system_id AND sh.so_id = soh.so_id
        WHERE soh.is_deleted = false
          AND UPPER(COALESCE(soh.so_status, '')) NOT IN ('C')
          AND (
            UPPER(COALESCE(soh.so_status, '')) IN ('K', 'P', 'S')
            OR (UPPER(COALESCE(soh.so_status, '')) = 'I'
                AND sh.invoice_date = (NOW() AT TIME ZONE 'America/Chicago')::date)
            OR soh.expect_date::date = (NOW() AT TIME ZONE 'America/Chicago')::date
          )
          AND UPPER(COALESCE(soh.sale_type, '')) NOT IN ('DIRECT', 'WILLCALL', 'XINSTALL', 'HOLD')
          AND soh.system_id NOT IN ('', 'SYSTEM')
      `;
      kpis.openPicks = picksRes?.cnt ?? 0;

      // Open work orders: count distinct WOs not completed/cancelled (by order, not by line)
      const [woRes] = await erpSql<{ cnt: number }[]>`
        SELECT COUNT(DISTINCT wh.wo_id)::int AS cnt
        FROM agility_wo_header wh
        LEFT JOIN agility_so_header soh
          ON soh.so_id = wh.source_id::text AND soh.is_deleted = false
        WHERE wh.is_deleted = false
          AND UPPER(COALESCE(wh.wo_status, '')) NOT IN ('COMPLETED', 'CANCELED', 'C')
          AND COALESCE(soh.system_id, '') NOT IN ('', 'SYSTEM')
      `;
      kpis.openWorkOrders = woRes?.cnt ?? 0;

      // Open orders count
      const [ordersRes] = await erpSql<{ cnt: number }[]>`
        SELECT COUNT(*)::int AS cnt
        FROM agility_so_header
        WHERE is_deleted = false AND UPPER(COALESCE(so_status,'')) = 'O'
      `;
      kpis.openOrders = ordersRes?.cnt ?? 0;
    } catch (err) {
      console.error('[api/home erp]', err);
    }
  }

  return NextResponse.json({ kpis, recentActivity, topPages } satisfies HomeData);
}
