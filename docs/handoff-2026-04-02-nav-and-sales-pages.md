# Handoff: Nav Restructuring + Sales/Purchasing/Credits Pages
**Date**: 2026-04-02
**Branch**: main

## What was completed this session

### 1. Nav Restructuring (`src/components/nav/TopNav.tsx`)
- Converted flat nav to support **dropdown submenus** for Purchasing and Sales sections
- New `DropdownNav` sub-component (click-outside, active state detection, chevron animation)
- Mobile drawer shows sections with indented children
- Added RMA Credits as a flat top-level link

### 2. Sales Sub-Pages
All pages follow the pattern: server `page.tsx` (auth + TopNav) → client component (data fetching + UI)

| Route | Client File | Notes |
|-------|------------|-------|
| `/sales/customers` | `CustomersClient.tsx` | Search `erp_mirror_cust`, link to profile |
| `/sales/customers/[code]` | `CustomerProfileClient.tsx` | Tabs: Overview, Orders (90d), Notes |
| `/sales/products` | `ProductsClient.tsx` | Search items + stock levels |
| `/sales/history` | `HistoryClient.tsx` | Expanded orders search with date range |
| `/sales/reports` | `ReportsClient.tsx` | KPIs + status breakdown + top customers |

Customer Notes read/write from `public.customer_notes` (WH-Tracker Alembic table) via `getErpSql()`.

### 3. Purchasing Sub-Pages
| Route | Client File | Notes |
|-------|------------|-------|
| `/purchasing/open-pos` | `OpenPosClient.tsx` | Uses `app_po_search` view, overdue highlight |
| `/purchasing/workspace` | `WorkspaceClient.tsx` | Buyer quick-actions + PO/submission cards |
| `/purchasing/manage` | `CommandCenterClient.tsx` | KPIs by branch, overdue list, recent check-ins |

### 4. RMA Credits (`/credits`, `app/api/credits/route.ts`)
- Queries `public.credit_images` table (WH-Tracker Alembic, shared Supabase instance)
- Shows metadata: RMA#, email from/subject, received date, filename count
- **Images are NOT viewable** — `filepath` column contains WH-Tracker local filesystem paths, not R2 keys

### 5. Fixes
- `purchasing/page.tsx` — refactored to server+client split (`CheckinClient.tsx`), now has TopNav
- `purchasing/review/ReviewClient.tsx` — now accepts `userName`/`userRole` props and renders TopNav
- `/api/purchasing/submissions` — now supports `?days=N` query param in addition to `?since=`

## New API Routes
```
GET  /api/sales/customers          ?q=&branch=&limit=
GET  /api/sales/customers/[code]   → { customer, orders, shiptos }
GET  /api/sales/customers/[code]/notes
POST /api/sales/customers/[code]/notes  { body, note_type, rep_name }
GET  /api/sales/products           ?q=&branch=&limit=
GET  /api/credits                  ?rma=&q=&limit=
```

## Known Issues / Next Steps

### Priority 1: Link customer names in SalesClient
`app/sales/SalesClient.tsx` renders customer names as plain text in the orders table. Should link to `/sales/customers/[cust_code]` — same as `HistoryClient.tsx` already does.

```tsx
// In SalesClient orders table, replace:
<span>{o.customer_name}</span>
// With:
{o.customer_code ? (
  <Link href={`/sales/customers/${encodeURIComponent(o.customer_code)}`}>
    {o.customer_name ?? o.customer_code}
  </Link>
) : o.customer_name}
```

### Priority 2: Sales Order Detail Page
`/sales/orders/[so_number]` — show line items from `erp_mirror_so_detail`. The SO number appears throughout the app but never links anywhere. Column schema:
```sql
SELECT * FROM erp_mirror_so_detail WHERE so_id = :so_number LIMIT 1
-- key cols: sequence, item, description, ordered_qty, shipped_qty, handling_code, line_total
```
Add API route `/api/sales/orders/[so_number]/route.ts` and a simple detail page.

### Priority 3: Purchasing Suggested Buys (`/purchasing/suggested-buys`)
Before building, verify the view exists:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name ILIKE 'app_purchasing%';
```
If `app_purchasing_queue` exists, it powers the WH-Tracker buyer workspace queue. Build a simple list view grouped by supplier.

### Priority 4: RMA Credits Image Serving (defer — confirmed R2 target)
Images SHOULD be stored in R2 (confirmed). The `credit_images.filepath` column currently holds WH-Tracker local paths — this is a known gap to fix later. Plan:
1. Add `r2_key TEXT` column to `public.credit_images` via Supabase SQL editor
2. Update WH-Tracker's `sync_email_credits.py` to upload email attachments to R2 and store the key
3. Add `/api/credits/[id]/image/route.ts` — generates a presigned R2 URL from `r2_key`
4. Update `CreditsClient.tsx` to show image thumbnails when `r2_key` is present
The metadata search page at `/credits` is ready and working — just missing image display.

### Priority 5: Bug Testing (users testing 2026-04-03)
Known risk areas from previous sessions:
- WH-Tracker public schema table access (pick, pickster tables)
- Samsara GPS vehicle data
- New customer/sales/purchasing pages (first time in prod)

## Architecture Reminders
- ERP data (public schema): use `getErpSql()` from `db/supabase.ts` — tagged template literals, no `prepare`
- App data (bids schema): use `getDb()` from `db/index.ts` + Drizzle ORM
- `public.customer_notes` is WH-Tracker's table — accessible via `getErpSql()`, no Drizzle schema
- Legacy repo at `C:\Users\amcgrean\python\wh-tracker-fly\WH-Tracker` for reference
- All new WH-Tracker page routes: `/sales`, `/dispatch`, `/delivery`, `/warehouse`, `/work-orders`, `/supervisor`, `/ops/delivery-reporting`, `/credits`, `/purchasing/*`
