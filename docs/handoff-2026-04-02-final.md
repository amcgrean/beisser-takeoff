# Handoff: WH-Tracker Migration Complete + Nav/Sales/Purchasing Extension
**Date**: 2026-04-02
**Branch**: main (f5e9fbb)

## State of the repo

All WH-Tracker modules are live on `main`. Two parallel agent sessions ran today and were merged via rebase. Everything is clean.

### What's in the codebase

**Navigation** (`src/components/nav/TopNav.tsx`):
Per-domain dropdowns using separate `ref`/`open` state per dropdown. Click-outside handler in a single `useEffect`. Mobile drawer shows section headers + sub-links.
- **Warehouse ▾**: Picks Board, Open Picks, Picker Stats
- **Sales ▾**: Sales Hub, Customers, Transactions, Purchase History, Products & Stock, Reports
- **Purchasing ▾**: PO Check-In, Open POs, Review Queue, Buyer Workspace, Command Center
- **Delivery ▾**: Delivery Tracker, Fleet Map
- **RMA Credits** — flat link

**Sales domain** — all pages have TopNav via server component wrapper:
- `/sales` — KPI + order table (`SalesClient.tsx`, `app/api/sales/metrics`, `/orders`)
- `/sales/transactions` — full order search (`TransactionsClient.tsx`)
- `/sales/history` — invoiced/closed with customer number filter (`HistoryClient.tsx`, `/api/sales/history`)
- `/sales/products` — item search with handling code badges (`ProductsClient.tsx`, `/api/sales/products`)
- `/sales/reports` — daily chart + top customers + sale type + ship via (`ReportsClient.tsx`, `/api/sales/reports`)
- `/sales/customers` — customer search (`CustomersClient.tsx`, `/api/sales/customers`)
- `/sales/customers/[code]` — profile with Overview / Orders / Notes tabs (`CustomerProfileClient.tsx`, `/api/sales/customers/[code]`, `/api/sales/customers/[code]/notes`)

**Two customer profile components exist** at `app/sales/customers/[code]/`:
- `CustomerClient.tsx` (from c55bca7) — overview + open orders + history + ship-to tabs
- `CustomerProfileClient.tsx` (from f5e9fbb) — same structure but adds **Notes tab** (read/write `public.customer_notes`)

`page.tsx` currently uses `CustomerProfileClient`. `CustomerClient.tsx` is present but unused — can be removed or kept as reference.

**Purchasing domain**:
- `/purchasing` — PO check-in workflow (`CheckinClient.tsx`)
- `/purchasing/open-pos` — open PO list with overdue highlight (`OpenPosClient.tsx`, `/api/purchasing/pos/open`)
- `/purchasing/pos/[po]` — PO detail with line items (`PosDetailClient.tsx`)
- `/purchasing/review` — submission queue (`ReviewClient.tsx`)
- `/purchasing/review/[id]` — review detail with photo viewer (`ReviewDetailClient.tsx`)
- `/purchasing/workspace` — buyer workspace: quick-action cards + upcoming POs (`WorkspaceClient.tsx`)
- `/purchasing/manage` — command center: KPI + by-branch + overdue + recent submissions (`CommandCenterClient.tsx`)

**Other WH-Tracker modules** (all complete):
- `/warehouse`, `/warehouse/open-picks`, `/warehouse/picker-stats`, `/warehouse/pickers`, `/warehouse/pickers/[id]`
- `/work-orders`
- `/dispatch`
- `/delivery`, `/delivery/map`
- `/supervisor`
- `/ops/delivery-reporting`
- `/credits` — metadata search only (`CreditsClient.tsx`, `/api/credits`)

## Priority next steps

### Priority 1 — Link customer names in SalesClient (quick fix)
`app/sales/SalesClient.tsx` orders table renders customer names as plain text. Should link to the customer profile.

```tsx
// Find the customer_name cell in SalesClient orders table. Replace:
<span>{o.customer_name}</span>
// With:
{o.customer_code ? (
  <Link href={`/sales/customers/${encodeURIComponent(o.customer_code)}`}>
    {o.customer_name ?? o.customer_code}
  </Link>
) : (o.customer_name ?? '—')}
```
`Link` is already imported in that file (check — if not, add `import Link from 'next/link'`).

### Priority 2 — Sales Order Detail Page
`/sales/orders/[so_number]` — show line items. SO numbers appear in many tables but never link anywhere.

**API route** (`app/api/sales/orders/[so_number]/route.ts`):
```sql
SELECT so_id, system_id, so_status, sale_type, ship_via, cust_name, expect_date, invoice_date, reference, po_number
FROM erp_mirror_so_header
WHERE so_id = :so_number AND is_deleted = false
LIMIT 1;

SELECT sequence, item, description, ordered_qty, shipped_qty, handling_code, line_total
FROM erp_mirror_so_detail
WHERE so_id = :so_number AND is_deleted = false
ORDER BY sequence;
```

**Page** (`app/sales/orders/[so_number]/page.tsx`): server component with TopNav + client component.

### Priority 3 — Purchasing Suggested Buys
Before building, verify the view exists:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name ILIKE 'app_purchasing%';
```
If `app_purchasing_queue` exists, build `/purchasing/suggested-buys` as a list grouped by supplier. Add to PURCHASING_LINKS in TopNav.

### Priority 4 — RMA Credits Image Serving (confirmed R2 target, deferred)
`credit_images.filepath` currently holds WH-Tracker local filesystem paths — not R2 keys. Plan:
1. Add `r2_key TEXT` column to `public.credit_images` via Supabase SQL editor
2. Update WH-Tracker `sync_email_credits.py` to upload email attachments to R2, store key
3. Add `/api/credits/[id]/image/route.ts` — generates presigned R2 URL from `r2_key`
4. Update `CreditsClient.tsx` to show image thumbnails when `r2_key` is present
The metadata search page at `/credits` is complete and working.

### Priority 5 — Flask Sunset
After user testing (2026-04-03) confirms feature parity:
1. DNS cutover from Flask domain to LiveEdge (Vercel)
2. Archive WH-Tracker repo (`C:\Users\amcgrean\python\wh-tracker-fly\WH-Tracker`)

## Architecture reminders

- **ERP queries**: `getErpSql()` from `db/supabase.ts` — tagged template literals, no `prepare`
- **App DB queries**: `getDb()` from `db/index.ts` + Drizzle ORM (`bids` schema)
- **`public.customer_notes`**: WH-Tracker Alembic table — use `getErpSql()`, no Drizzle schema needed
- **Next.js 15 params**: `params` is `Promise<{ id: string }>` — always `await params`
- **Page pattern**: server `page.tsx` (auth + `<TopNav>` + `<ClientComponent>`) → client `*Client.tsx` (data fetching + UI)
- **Legacy Flask repo**: `C:\Users\amcgrean\python\wh-tracker-fly\WH-Tracker` for reference
