# Beisser Takeoff — Development Context

## Project Overview
Beisser Lumber Co. internal estimating app (Next.js 15, TypeScript, Tailwind, Drizzle ORM, Supabase Postgres, NextAuth v5). Used by sales staff/estimators at four Iowa lumberyard locations.

## Architecture Overview

### Single Database — Supabase (agility-api project)
All data lives in one Supabase Postgres instance, split into two schemas:

| Schema | Owner | Contents |
|--------|-------|----------|
| `public` | WH-Tracker (Alembic) | ERP mirror tables (`erp_mirror_*`), WH-Tracker app tables |
| `bids` | beisser-takeoff (Drizzle) | All beisser-takeoff tables — UUID-based new tables + migrated legacy serial-ID tables |

**Never run drizzle-kit against the `public` schema.** `drizzle.config.ts` has `schemaFilter: ['bids']` to enforce this.

### Database Connections
- `db/index.ts` — App DB. Uses `postgres.js` + `drizzle-orm/postgres-js`. Resolves `BIDS_DATABASE_URL` → `POSTGRES_URL_NON_POOLING` → `POSTGRES_URL`. All tables in `bids` schema.
- `db/supabase.ts` — ERP reads. Same Supabase instance, `public` schema. Exports `getErpDb()`, `getErpSql()`, `isErpConfigured()`.

Both connections use `prepare: false` and `max: 1` (serverless-safe, pgBouncer-compatible).

### Schema Files
- `db/schema.ts` — UUID-based tables in `bids` schema. Drizzle-managed via `drizzle-kit`. Exports `bidsSchema` (the `pgSchema('bids')` instance).
- `db/schema-legacy.ts` — Legacy serial-ID tables in `bids` schema. **READ/WRITE definitions only — never run drizzle-kit push/generate against these.** Imports `bidsSchema` from `schema.ts`.
- `db/migrations/` — SQL migration files. `0003*` files must be applied manually in Supabase SQL editor.

### Key Relationships
- `legacyBid` (serial int, `bids.bid` table) = legacy flat bid tracker entry
- `bids` (UUID, `bids.bids` table) = takeoff/estimating project with JSONB `inputs`
- `takeoffSessions.bidId` → `bids.bids.id` (UUID FK)
- `takeoffSessions.legacyBidId` → `bids.bid.id` (integer FK — added via 0003c migration)
- "Start Takeoff" from a legacy bid creates a `bids` record + `takeoffSession` linked to both

### Schema Enhancements (added during Supabase migration)
- `users`: `legacy_id` (maps Flask serial user), `branch_id`, `is_estimator`, `is_designer`, `is_commercial_estimator`, `permissions` (JSONB), `last_login`, `login_count`, `deleted_at`
- `customers`: `legacy_id` (maps Flask serial customer), `deleted_at`
- `bids`, `takeoff_sessions`: `deleted_at` (soft delete)
- `customers.name`, `bids.job_name`: GIN full-text search indexes
- `general_audit.changes`: upgraded from `text` to `jsonb`
- All timestamps: `withTimezone: true`

### Auth
- NextAuth v5 beta, credentials provider, JWT strategy
- Legacy `bids."user"` table (serial IDs, plain-text passwords — bcrypt migration pending in Phase 5)
- `auth.ts` does raw SQL against `bids."user"` table
- Dev bypass: username `admin` / password `ChangeMe123!`

## PDF Takeoff Engine

PDF measurement and markup engine replacing Bluebeam Revu ($349/seat/year). Multi-scale construction drawings with multiple viewports per page.

### Architecture
- Two stacked canvas layers: pdfjs-dist v5 (bottom, read-only) + Fabric.js v7 (top, interactive)
- **CRITICAL**: Fabric.js v7 uses `opt.scenePoint` (NOT `opt.pointer`) for mouse event coordinates
- Zoom uses `canvas.setZoom()` transform only (never repositions objects)
- Page state serialized to JSON on page change, restored on return

### Key Files
```
src/lib/takeoff/
  calculations.ts    — Pure functions: calcPolylineLength, calcPolygonArea, calcCount, scale presets
  presets.ts          — 49 named measurement presets mapping to JobInputs fields
  pdfLoader.ts        — pdfjs-dist v5 setup, worker config, page rendering
  fabricHelpers.ts    — Fabric.js v7 canvas setup, zoom/pan, measurement objects, annotations
  viewportDetector.ts — Viewport hit detection
  exportCsv.ts        — CSV export via papaparse
  exportPdf.ts        — Annotated PDF export via jspdf + headless Fabric canvas compositing
  r2.ts               — Cloudflare R2 client (S3-compatible): upload, download, presigned URLs

src/hooks/
  useMeasurementReducer.ts — Full takeoff state (viewports, groups, measurements, pages, tools)
  useUndoRedo.ts            — Command-stack undo/redo
  useTakeoffSession.ts      — Session load/save, 2s debounced auto-save

src/components/takeoff/
  TakeoffCanvas.tsx          — Core dual-canvas component with all tool handlers
  TakeoffToolbar.tsx         — Two-row toolbar (session info + tools)
  BottomBar.tsx              — Bluebeam-style bottom bar: page nav, zoom, scroll mode toggle
  PageNavigator.tsx          — Collapsible thumbnail strip
  MeasurementSidebar.tsx     — Preset panel with categories and running totals
  MeasurementInspector.tsx   — Click-to-inspect detail panel
  ViewportManager.tsx        — Viewport list/manage
  ScaleCalibration.tsx       — Scale preset picker + manual calibration

app/takeoff/                 — Session list with optional bid-link search
app/takeoff/[sessionId]/     — Full workspace (TakeoffWorkspace.tsx)
```

### Named Tool Presets (Critical Feature)
Users measure by clicking preset buttons (e.g., "1st Floor Ext 2x6 9'") which activate the right tool type with the right color. Each preset's `targetField` maps to a specific `JobInputs` field (e.g., `firstFloor.ext2x6_9ft`). "Send to Estimate" writes accumulated totals directly to the linked bid.

## Migration Status (Flask → Next.js)

Full migration plan in `docs/migration-plan.md`. Six phases.

### Phase 0: Foundation — COMPLETE
- `db/schema-legacy.ts`: Drizzle definitions for all legacy tables
- Auth bridge, permissions middleware, branch context

### Phase 1: Legacy Bid Tracker — COMPLETE
- **Dashboard**: `app/dashboard/` — KPI cards (open bids, open designs, YTD completed, avg completion time), activity feed, quick action links. API: `app/api/dashboard/route.ts`.
- **Legacy bid CRUD**: `app/legacy-bids/` — List (paginated, filtered, sorted), add, manage. API: `app/api/legacy-bids/route.ts` + `[id]/route.ts` + `[id]/activity/route.ts`.
- **Bid file attachments**: `app/api/legacy-bids/[id]/files/route.ts` — Presigned R2 upload + proxy fallback + delete. ManageBidClient has upload/delete UI.
- **Bid → Takeoff link**: `app/api/legacy-bids/[id]/start-takeoff/route.ts` — Creates `bids` record + `takeoffSession` from legacy bid. Spec flags (includeFraming/Siding/Shingle/Deck/Trim/Window/Door) pre-filter which measurement presets load. ManageBidClient shows "Start Takeoff" or "Open Takeoff" button.
- **Standalone takeoff link**: `app/takeoff/TakeoffSessionList.tsx` — Optional bid-link search when creating a new session. Confirms if user skips linking.
- **Schema**: `takeoff_sessions.legacy_bid_id` (integer) links to legacy bid table.

### Phase 2: Designs, EWP, Projects — COMPLETE
- EWP pages: `app/ewp/` (list, add, manage)
- Projects pages: `app/projects/` (list, manage)
- Design management still needs full CRUD (2A) and Layouts (2B)

### Phase 3: Admin Portal Expansion — COMPLETE
- Permissions: `app/admin/users/[id]/permissions/`
- Bid Fields: `app/admin/bid-fields/`
- Notifications: `app/admin/notifications/`
- Audit: `app/admin/audit/`
- IT Issues: `app/it-issues/`
- Supporting libs: `src/lib/audit.ts`, `src/lib/notifications.ts`, `src/lib/csv-utils.ts`
- CSV import/export endpoints

### Phase 4: ERP Sync — COMPLETE
- **Supabase connection**: `db/supabase.ts` (postgres.js driver, singleton, ERP public schema reads)
- **Sync engine**: `src/lib/erp-sync.ts` — Customer sync (upserts erp_mirror_cust → bids.customers), item search (joins item + item_branch, filtered by branch), ship-to lookup, raw table query for admin
- **API routes**: `/api/erp/items`, `/api/erp/customers/[code]`, `/api/erp/customers/[code]/ship-to`
- **Admin panel**: `app/admin/erp/` — Connection status, table discovery, column viewer, data preview, manual sync, sync history
- **Cron**: `/api/cron/erp-sync` — Daily at 6 AM UTC

### Phase 4.5: Supabase DB Migration — COMPLETE (code merged, data migration pending)
- All app tables now defined in `bids` schema on Supabase (was Neon `public`)
- Driver switched from `@neondatabase/serverless` to `postgres.js` across the board
- `db/migrate-from-neon.ts` — one-time migration script, run after SQL files applied
- Migration SQL files in `db/migrations/0003*` — apply in Supabase SQL editor before running script

### Phase 5: Unification and Cleanup — NOT STARTED
- Unified bid view (legacy flat + JSONB takeoff bids in combined display)
- Password security (bcrypt migration for legacy `bids."user"` table)
- Customer-centric views (all bids for a customer)

### Phase 6: Polish and Sunset — NOT STARTED
- Print-optimized CSS, responsive audit, error boundaries
- Flask app sunset, DNS routing, archive

## Pending Actions
1. **Execute data migration**: Apply SQL files `0003`, `0003b`, `0003c` in Supabase SQL editor, then run `db/migrate-from-neon.ts` (see script header for full instructions)
2. **Set Fly secret**: `fly secrets set BIDS_DATABASE_URL="<supabase-direct-url>"` after data migration verified
3. **Remove Neon secret**: Remove old Neon `DATABASE_URL` Fly secret after 2-week validation window
4. **Design management (2A)**: Full CRUD for designs with activity log
5. **Layouts management (2B)**: Full CRUD for layouts/EWP with CSV import
6. **Phase 5**: Unified bid view, bcrypt password migration, customer-centric views
7. **Phase 6**: Polish, Flask sunset

## API Route Patterns
- **Legacy tables**: Import from `'<relative>/db/schema-legacy'`, use `legacyBid`, `legacyCustomer`, etc. (all now in `bids` schema — queries work transparently via Drizzle)
- **New tables**: Import from `'<relative>/db/index'` as `{ getDb, schema }`
- **ERP queries**: Import from `'<relative>/db/supabase'` as `{ getErpDb }`
- **Auth**: `import { auth } from '<relative>/auth'`
- **Branch context**: `import { getSelectedBranchId } from '@/lib/branch-context'`
- API route `params` in Next.js 15 are `Promise<{ id: string }>` — must `await params`

## Tech Stack
- Next.js 15.1 (App Router), React 19, TypeScript 5.7
- Tailwind CSS 3.4 (dark theme, cyan accent: brand.400/500/600)
- Drizzle ORM + Supabase Postgres (`bids` schema, postgres.js driver)
- Supabase Postgres (ERP reads via `public` schema, same instance)
- Cloudflare R2 (file storage via @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner)
- NextAuth v5 beta (credentials provider, JWT strategy)
- pdfjs-dist 5.6, fabric 7.x (NOT v6 — mouse event API differs), jspdf 2.x
- Lucide React icons, papaparse, zod, date-fns

## Environment Variables
- `BIDS_DATABASE_URL` — Supabase direct connection string (port 5432, **not** pooler 6543). Primary app DB.
- `POSTGRES_URL_NON_POOLING` — Vercel Supabase integration direct URL (fallback for `BIDS_DATABASE_URL`)
- `POSTGRES_URL` — Vercel Supabase integration pooled URL (last resort)
- `AUTH_SECRET` — NextAuth secret
- `R2_ACCOUNT_ID` — Cloudflare account ID
- `R2_ACCESS_KEY_ID` — R2 API token access key
- `R2_SECRET_ACCESS_KEY` — R2 API token secret
- `R2_BUCKET_NAME` — R2 bucket name (defaults to `bids`)
- `CRON_SECRET` — Bearer token for cron endpoint auth

## Navigation Structure
- **Top nav**: Dashboard, Bids, Designs, EWP, Projects, IT Issues, Estimating, PDF Takeoff
- **Admin dropdown** (admin role only): Dashboard, Customers, Products/SKUs, Formulas, Users, Bid Fields, Notifications, Audit Log, ERP Sync
- Component: `src/components/nav/TopNav.tsx`

## Key Conventions
- Path alias: `@/*` → `./src/*`, `@/db/*` → `./db/*` (but API routes use relative paths for db imports)
- Legacy table column names match Flask/SQLAlchemy models exactly (e.g., `customerCode` not `customer_code`)
- All tables (new + legacy) are in the `bids` schema — Drizzle handles schema qualification transparently
- Admin customers page uses `legacyCustomer` (serial IDs), NOT `schema.customers` (UUID)
- `createdBy` omitted from takeoff session inserts (legacy serial user IDs incompatible with UUID FK)
- `general_audit.changes` is `jsonb` (not `text`) — Drizzle types it as `unknown`; cast or handle accordingly in consuming code
