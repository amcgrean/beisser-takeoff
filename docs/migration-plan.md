# Estimating App Migration Plan

**Goal:** Merge the Flask/Python `estimating-app` into `beisser-takeoff` (Next.js 15/TypeScript). One unified app, single Supabase Postgres database. Convert all Python logic to TypeScript. Sunset Flask when done.

**Decisions made:**
- Migrate ALL Flask features (bids, designs, layouts/EWP, projects, notifications, IT issues, audit, ERP sync, permissions, dynamic fields)
- Consolidate file storage on Cloudflare R2 (read legacy S3 files during transition, write everything new to R2)
- Use Resend for email notifications
- **DB platform**: Neon → Supabase (`bids` schema). ERP mirror tables remain in `public` schema on the same instance. WH-Tracker owns `public` via Alembic — zero collision risk.

---

## Phase 0: Foundation (Legacy Schema + Auth Bridge)

Everything depends on this phase. We need typed Drizzle access to all legacy tables before building any features.

### 0A. Define Drizzle schema for legacy tables

**Create:** `db/schema-legacy.ts`

Map every existing Flask/SQLAlchemy table to a `pgTable` definition with `serial('id')` primary keys. This file is READ-ONLY definitions — we never run migrations against these tables.

Tables to define:
| Drizzle name | Postgres table | Key columns |
|---|---|---|
| `legacyUser` | `"user"` | id, username, email, password_hash, is_active, is_admin, is_estimator, is_designer, branch_id, user_type_id |
| `legacyUserType` | `"user_type"` | id, name |
| `legacyUserSecurity` | `"user_security"` | user_type_id, 20+ boolean permission flags |
| `legacyEstimator` | `"estimator"` | id, name, branch_id, plan_type |
| `legacyDesigner` | `"designer"` | id, name, branch_id |
| `legacyBranch` | `"branch"` | id, name, code, type |
| `legacyCustomer` | `"customer"` | id, code, name, sales_rep, branch_id |
| `legacyBid` | `"bid"` | id, customer_id, sales_rep_id, estimator_id, project_name, plan_type, status, log_date, due_date, completion_date, spec_framing, spec_siding, spec_shingles, spec_deck, spec_trim, spec_windows, spec_doors, notes_framing, notes_siding, ... |
| `legacyDesign` | `"design"` | id, planNumber, plan_name, customer_id, designer_id, contractor, project_address, status |
| `legacyJob` | `"job"` | id, customer_id, name, status |
| `legacyProject` | `"project"` | id, customer_id, contractor, name, inclusion flags |
| `legacyBidFile` | `"bid_file"` | id, bid_id, file_type, filename, s3_key, uploaded_at |
| `legacyBidField` | `"bid_field"` | id, name, field_type, category, is_required, is_active, branch_id, sort_order |
| `legacyBidValue` | `"bid_value"` | id, bid_id, field_id, value |
| `legacyBidActivity` | `"bid_activity"` | id, bid_id, user_id, action, timestamp |
| `legacyDesignActivity` | `"design_activity"` | id, design_id, user_id, action, timestamp |
| `legacyLoginActivity` | `"login_activity"` | id, user_id, timestamp, ip_address |
| `legacyGeneralAudit` | `"general_audit"` | id, user_id, action, entity_type, entity_id, details, timestamp |
| `legacyNotificationRule` | `"notification_rule"` | id, event_type, recipient_type, branch_id, bid_type, user_id |
| `legacyNotificationLog` | `"notification_log"` | id, rule_id, bid_id, recipient, sent_at, status |
| `legacyEWP` | `"ewp"` | id, customer_id, designer_id, tji_depth, status, dates |
| `legacyITService` | `"it_service"` | id, user_id, issue_type, description, status |

**Modify:** `db/index.ts` — Export legacy schema alongside existing schema.
**Modify:** `drizzle.config.ts` — Add `tablesFilter` to exclude legacy table names from migration generation.

### 0B. Update auth to use Drizzle

**Modify:** `auth.ts`
- Replace raw `db.execute(sql\`SELECT ... FROM "user"\`)` with typed Drizzle query: `db.select().from(legacySchema.legacyUser).where(eq(...))`
- Add `branchId` to JWT token from user's `branch_id` column
- Add login activity tracking: insert into `legacyLoginActivity` on successful auth

### 0C. Permission middleware

**Create:** `src/lib/permissions.ts`
- Define `Permission` type with all 20+ Flask permission flags mapped to dot-notation strings (`bid.create`, `bid.edit`, `bid.delete`, `bid.view_all`, `design.create`, etc.)
- `getUserPermissions(userId)` — queries `legacyUserSecurity` via user's `user_type_id`
- `requirePermission(session, permission)` — returns 403 or passes through
- Backward compat: admin gets all, estimator gets default set, viewer is read-only

**Create:** `src/lib/auth-helpers.ts`
- Extract shared auth utilities: `requireAuth()`, `requireAdmin()`, `requireRole()`, `getCurrentBranch()`
- Refactor existing inline auth checks in API routes to use these

### 0D. Branch context

**Create:** `src/lib/branch-context.ts`
- `getBranchId(session)` — reads from JWT token
- `setBranch(branchId)` — client-side API call to update JWT
- API route: `app/api/auth/set-branch/route.ts` — updates session/token with selected branch

---

## Phase 1: Legacy Bid Tracker

The Flask app's core feature. The legacy `bid` table is flat (spec toggles + notes) — completely separate from the JSONB-based `bids` table used by the takeoff engine.

### 1A. Dashboard

**Create:**
- `app/dashboard/page.tsx` — Server component, auth-gated landing page
- `app/dashboard/DashboardClient.tsx` — KPI cards: open bids, open designs, YTD completed, avg completion time, recent activity feed
- `app/api/dashboard/route.ts` — Aggregation queries against legacy tables, branch-scoped

### 1B. Legacy bid CRUD

**Create:**
- `app/legacy-bids/page.tsx` + `LegacyBidsClient.tsx` — Paginated table with search, status filter (open/completed/all), branch filter, estimator type filter (commercial/residential), sortable columns
- `app/legacy-bids/add/page.tsx` + `AddBidClient.tsx` — Create form: customer (autocomplete), sales rep, estimator, plan type, due date, spec toggles, notes, file uploads
- `app/legacy-bids/[id]/page.tsx` + `ManageBidClient.tsx` — Edit form with all fields, status updates, activity log, file management
- `app/legacy-bids/completed/page.tsx` + `CompletedBidsClient.tsx` — YTD completed bids with date range filter
- `app/legacy-bids/calendar/page.tsx` + `CalendarClient.tsx` — Calendar view of open bids by due date
- `app/legacy-bids/print/page.tsx` — Print-optimized open bids list

**Create API routes:**
- `app/api/legacy-bids/route.ts` — GET (list, paginated/filtered/sorted), POST (create)
- `app/api/legacy-bids/[id]/route.ts` — GET, PUT, DELETE
- `app/api/legacy-bids/[id]/activity/route.ts` — GET activity log, POST new entry

### 1C. Bid file attachments

Leverage existing R2 infrastructure from `src/lib/r2.ts`.

**Create:**
- `src/lib/file-storage.ts` — Extended file operations: upload, download, delete, list by prefix, presigned URLs. Supports both reading legacy S3 keys and writing new files to R2 with `bids/{year}/{customerCode}/{bidId}/` prefix.
- `app/api/legacy-bids/[id]/files/route.ts` — GET (list files), POST (initiate upload)
- `app/api/legacy-bids/[id]/files/[fileId]/route.ts` — GET (download/presigned), DELETE
- `app/api/legacy-bids/[id]/files/zip/route.ts` — GET (ZIP download of all files)

**Add dependency:** `archiver` for ZIP generation.

### 1D. PDF spec sheet generation

Convert Flask's ReportLab `pdf_generator.py` to TypeScript using existing `jspdf` dependency.

**Create:**
- `src/lib/pdf-spec-sheet.ts` — `generateSpecSheet(bid): Uint8Array` — renders bid details, spec toggles, notes as a formatted PDF
- `app/api/legacy-bids/[id]/spec-sheet/route.ts` — GET returns PDF

---

## Phase 2: Designs, Layouts, EWP, Projects

These features exist only in Flask. Straightforward CRUD pages following the same patterns established in Phase 1.

### 2A. Design management

**Create:**
- `app/designs/page.tsx` + `DesignsClient.tsx` — Paginated list with branch/status filter, search, "recently viewed" tracking
- `app/designs/add/page.tsx` + `AddDesignClient.tsx` — Create form with auto-generated plan numbers
- `app/designs/[id]/page.tsx` + `ManageDesignClient.tsx` — Edit/manage design with activity log
- `app/api/designs/route.ts` — GET, POST
- `app/api/designs/[id]/route.ts` — GET, PUT, DELETE
- `app/api/designs/[id]/activity/route.ts` — Activity tracking

### 2B. Layout/EWP management

**Create:**
- `app/layouts/page.tsx` + `LayoutsClient.tsx` — List with pagination and filter
- `app/layouts/[id]/page.tsx` + `EditLayoutClient.tsx`
- `app/layouts/add/page.tsx`
- `app/api/layouts/route.ts` + `app/api/layouts/[id]/route.ts`
- `app/api/layouts/import/route.ts` — CSV import endpoint
- `app/ewp/page.tsx` + `EWPClient.tsx`
- `app/ewp/[id]/page.tsx`
- `app/api/ewp/route.ts` + `app/api/ewp/[id]/route.ts`

### 2C. Project management

**Create:**
- `app/projects/page.tsx` + `ProjectsClient.tsx`
- `app/projects/[id]/page.tsx`
- `app/api/projects/route.ts` + `app/api/projects/[id]/route.ts`

---

## Phase 3: Admin Portal Expansion

Extend the existing admin portal at `app/admin/`.

### 3A. Granular user permissions

**Create:**
- `app/admin/users/[id]/permissions/page.tsx` + `PermissionsClient.tsx` — Matrix of 20+ toggleable permission flags
- `app/api/admin/users/[id]/permissions/route.ts` — GET, PUT

**Modify:** `app/admin/users/UsersClient.tsx` — Add "Permissions" link per user row.

### 3B. Dynamic bid fields

**Create:**
- `app/admin/bid-fields/page.tsx` + `BidFieldsClient.tsx` — CRUD with drag-reorder, branch filter, visibility toggles, bulk update
- `app/api/admin/bid-fields/route.ts` — GET, POST, PUT (bulk reorder)
- `app/api/admin/bid-fields/[id]/route.ts` — GET, PUT, DELETE

**Modify:** `app/legacy-bids/[id]/ManageBidClient.tsx` — Dynamically render fields from BidField definitions, save to BidValue.

### 3C. Notification system (Resend)

**Add dependency:** `resend`

**Create:**
- `src/lib/notifications.ts` — Notification engine: `processNotification(event, context)` checks rules, sends via Resend, logs to NotificationLog
- `app/admin/notifications/page.tsx` + `NotificationsClient.tsx` — CRUD for rules + log viewer
- `app/api/admin/notifications/route.ts` + `[id]/route.ts`
- `app/api/admin/notifications/logs/route.ts` — GET recent logs

**Modify:** Legacy bid and design API routes — call `processNotification()` after status changes.

**Add env var:** `RESEND_API_KEY`

### 3D. CSV import/export

**Create:**
- `src/lib/csv-utils.ts` — Shared parse/generate utilities (extends existing papaparse usage)
- `app/api/admin/users/import/route.ts` + `export/route.ts`
- `app/api/admin/customers/import/route.ts` + `export/route.ts`
- `app/api/legacy-bids/import/route.ts` — Historical bid import
- `app/api/designs/import/route.ts` — Historical design import

**Modify:** Admin users + customers pages — add Import/Export buttons.

### 3E. Audit trail

**Create:**
- `src/lib/audit.ts` — `logAudit(userId, action, entityType, entityId, details)` inserts into GeneralAudit
- `app/admin/audit/page.tsx` + `AuditClient.tsx` — Searchable log viewer with entity type filter, date range, pagination
- `app/api/admin/audit/route.ts`

**Modify:** All CRUD API routes — call `logAudit()` on create/update/delete operations.

### 3F. IT issue tracking

**Create:**
- `app/it-issues/page.tsx` + `ITIssuesClient.tsx` — List with status filter
- `app/it-issues/[id]/page.tsx`
- `app/api/it-issues/route.ts` + `[id]/route.ts`

### 3G. Navigation updates

**Modify:** `src/components/nav/TopNav.tsx` (or equivalent nav component)
- Add top-level nav items: Dashboard, Designs, Layouts, EWP, Projects
- Update admin dropdown: Permissions, Bid Fields, Notifications, Audit Log
- Add IT Issues link

---

## Phase 4: ERP Sync — ✅ COMPLETE

- `src/lib/erp-sync.ts` — Customer sync, item search, ship-to lookup
- `app/api/cron/erp-sync/route.ts` — Token-protected cron endpoint
- `app/admin/erp/` — Admin panel: connection status, table discovery, manual sync, sync history

---

## Phase 4.5: Supabase DB Migration — ✅ CODE MERGED / DATA MIGRATION PENDING

Moved all beisser-takeoff tables from Neon `public` to Supabase `bids` schema.

**What's done:**
- `db/schema.ts` — `pgSchema('bids')` on all tables; enhanced columns (legacy_id bridge, deleted_at, user profile fields, FTS indexes)
- `db/schema-legacy.ts` — All legacy serial-ID tables now use `bidsSchema.table()`; `general_audit.changes` upgraded to JSONB
- `db/index.ts` — Driver switched from `@neondatabase/serverless` to `postgres.js`
- `db/supabase.ts` — ERP-only connection; same Supabase instance, `public` schema
- `drizzle.config.ts` — `schemaFilter: ['bids']`, `BIDS_DATABASE_URL`, UUID tables only in `tablesFilter`
- `db/migrations/0003_bids_schema_migration.sql` — Full DDL for UUID tables in bids schema
- `db/migrations/0003b_legacy_tables_migration.sql` — Full DDL for legacy serial-ID tables
- `db/migrations/0003c_legacy_fk_constraints.sql` — FK from takeoff_sessions → bid.id + sequence resets (run AFTER data load)
- `db/migrate-from-neon.ts` — One-time idempotent data migration script

**What still needs to happen (in order):**
1. Apply `0003_bids_schema_migration.sql` in Supabase SQL editor
2. Apply `0003b_legacy_tables_migration.sql` in Supabase SQL editor
3. Run: `NEON_DATABASE_URL=... BIDS_DATABASE_URL=... npx tsx db/migrate-from-neon.ts`
4. Apply `0003c_legacy_fk_constraints.sql` in Supabase SQL editor
5. `fly secrets set BIDS_DATABASE_URL="<supabase-direct-url>"`
6. Verify staging, then remove old Neon DATABASE_URL Fly secret

---

## Phase 5: Unification and Cleanup

### 5A. Unified bid view

**Create:**
- `src/lib/bid-adapter.ts` — Normalizes both legacy bids (flat table) and takeoff bids (JSONB) to a common `UnifiedBidView` type for combined display

**Modify:** `app/bids/page.tsx` — Option to show combined view of both bid tables.

### 5B. Password security

**Create:**
- `app/api/admin/users/migrate-passwords/route.ts` — One-time endpoint: read all users, hash plain-text passwords with bcrypt, update in place

**Modify:** `auth.ts` — Support both bcrypt and plain-text comparison during transition. After migration, remove plain-text fallback.

### 5C. Customer-centric views

**Create:**
- `app/customers/[id]/bids/page.tsx` — All bids for a customer (both legacy and takeoff)
- `app/api/customers/[id]/bids/route.ts`

---

## Phase 6: Polish and Sunset

- Print-optimized CSS (`@media print` rules in `globals.css`)
- Responsive design audit across all new pages
- Error boundary components for new routes
- Remove Flask app from production deployment
- Update DNS/routing to point all traffic to Next.js app
- Archive Flask repo

---

## Dependency Graph

```
Phase 0 (Foundation) ─── MUST be first
  0A: Schema definitions
  0B: Auth update (needs 0A)
  0C: Permissions (needs 0A)
  0D: Branch context (needs 0B)

Phase 1 (Bids) ─── needs Phase 0
  1A: Dashboard  ─┐
  1B: Bid CRUD   ─┤ can run in parallel
  1C: Bid files (needs 1B)
  1D: PDF specs (needs 1B)

Phase 2 (Designs/Layouts/EWP) ─── needs Phase 0, parallel with Phase 1
  2A: Designs   ─┐
  2B: Layouts   ─┤ all independent
  2C: Projects  ─┘

Phase 3 (Admin expansion) ─── needs Phases 0-2
  3A: Permissions (needs 0C)
  3B: Dynamic fields (needs 1B)
  3C: Notifications (needs 1B, 2A)
  3D-3F: Independent, can parallel

Phase 4 (ERP Sync) ─── needs Phase 0 only
Phase 5 (Unification) ─── needs Phases 1-3
Phase 6 (Polish) ─── after everything
```

## New Dependencies

| Package | Purpose | Phase |
|---------|---------|-------|
| `resend` | Email notifications via Resend API | 3C |
| `archiver` | ZIP file generation for bid file downloads | 1C |

## New Environment Variables

| Variable | Purpose | Phase |
|----------|---------|-------|
| `RESEND_API_KEY` | Resend email service API key | 3C |
| `CRON_SECRET` | Bearer token for ERP sync cron endpoint | 4 |

## Key Risks

1. **Dual ID systems** — Legacy tables use `serial` integers, new tables use UUIDs. Auth already stores `String(user.id)` in session. Cross-references must use the correct type.
2. **Legacy table name collisions** — Flask's `"branch"` table vs Drizzle's `"branches"` table. Both exist with different schemas. `schema-legacy.ts` must map to exact table names.
3. **Drizzle migration safety** — NEVER run `drizzle-kit push/generate` against legacy tables. Use `tablesFilter` in config.
4. **Legacy S3 files** — During transition, must be able to read files from the original S3 bucket. R2 is S3-compatible so we can potentially point the R2 client at the old S3 endpoint for reads.
5. **DB platform change** — App tables moved from Neon to Supabase `bids` schema. `db/migrate-from-neon.ts` handles the one-time data transfer. The `public` schema (ERP + WH-Tracker) is untouched.
