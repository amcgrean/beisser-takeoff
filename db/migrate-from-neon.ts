/**
 * One-time data migration: Neon (public schema) → Supabase (bids schema)
 *
 * Usage:
 *   NEON_DATABASE_URL="<neon-connection-string>" \
 *   BIDS_DATABASE_URL="<supabase-direct-connection-string>" \
 *   npx tsx db/migrate-from-neon.ts
 *
 * Prerequisites:
 *   1. Apply 0003_bids_schema_migration.sql in Supabase SQL editor
 *   2. Apply 0003b_legacy_tables_migration.sql in Supabase SQL editor
 *   3. Run this script
 *   4. Apply 0003c_legacy_fk_constraints.sql in Supabase SQL editor
 *
 * What this script does:
 *   - Copies all rows from every Neon table to the matching Supabase bids.* table
 *   - Handles the general_audit.changes column upgrade (TEXT → JSONB)
 *   - Backfills users.legacy_id and customers.legacy_id from the legacy tables
 *   - Validates row counts after each table migration
 *   - Is idempotent: safe to re-run (uses INSERT ... ON CONFLICT DO NOTHING)
 *
 * After a successful run:
 *   - Keep NEON_DATABASE_URL in your local .env for 2 weeks as a read-only fallback
 *   - Remove it from Vercel environment variables immediately after verifying production
 */

import postgres from 'postgres';

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

const NEON_URL = process.env.NEON_DATABASE_URL;
const SUPABASE_URL = process.env.BIDS_DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;

if (!NEON_URL) {
  console.error('ERROR: NEON_DATABASE_URL is required');
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.error('ERROR: BIDS_DATABASE_URL or POSTGRES_URL_NON_POOLING is required');
  process.exit(1);
}

const neon = postgres(NEON_URL, { max: 1, idle_timeout: 30 });
const supabase = postgres(SUPABASE_URL, { max: 1, idle_timeout: 30 });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function countRows(db: ReturnType<typeof postgres>, schema: string, table: string): Promise<number> {
  const quoted = table === 'user' ? `${schema}."user"` : `${schema}.${table}`;
  const result = await db`SELECT COUNT(*)::int AS n FROM ${db.unsafe(quoted)}`;
  return result[0].n;
}

async function migrateTable(
  tableName: string,
  options: {
    pkColumn?: string;
    transform?: (row: Record<string, unknown>) => Record<string, unknown>;
  } = {}
): Promise<void> {
  const { pkColumn = 'id', transform } = options;
  const quoted = tableName === 'user' ? 'public."user"' : `public.${tableName}`;
  const destQuoted = tableName === 'user' ? 'bids."user"' : `bids.${tableName}`;

  console.log(`\n  → ${tableName}`);

  const sourceCount = await countRows(neon, 'public', tableName);
  if (sourceCount === 0) {
    console.log(`     (empty — skipping)`);
    return;
  }

  const rows = await neon`SELECT * FROM ${neon.unsafe(quoted)} ORDER BY ${neon.unsafe(pkColumn)}`;
  const transformed = transform ? rows.map(transform) : rows;

  if (transformed.length === 0) return;

  // Build column list from first row
  const cols = Object.keys(transformed[0]);
  const colList = cols.map((c) => `"${c}"`).join(', ');

  let inserted = 0;
  // Batch in chunks to avoid parameter limits
  const CHUNK = 500;
  for (let i = 0; i < transformed.length; i += CHUNK) {
    const chunk = transformed.slice(i, i + CHUNK);
    const values = chunk.map((row) => cols.map((c) => row[c]));
    await supabase`
      INSERT INTO ${supabase.unsafe(destQuoted)} (${supabase.unsafe(colList)})
      SELECT * FROM UNNEST(${supabase.unsafe(
        values.map((v) => `ARRAY[${v.map((_, idx) => `$${idx + 1}`).join(', ')}]`).join(', ')
      )})
      ON CONFLICT (${supabase.unsafe(`"${pkColumn}"`)}) DO NOTHING
    `.catch(async () => {
      // Fall back to row-by-row if bulk fails (e.g. type mismatch edge cases)
      for (const row of chunk) {
        const rowCols = Object.keys(row).map((c) => `"${c}"`).join(', ');
        const rowVals = Object.values(row);
        await supabase`
          INSERT INTO ${supabase.unsafe(destQuoted)} (${supabase.unsafe(rowCols)})
          VALUES ${supabase(rowVals)}
          ON CONFLICT ("${supabase.unsafe(pkColumn)}") DO NOTHING
        `.catch((e) => {
          console.warn(`     WARN: failed row ${JSON.stringify(row[pkColumn])}: ${e.message}`);
        });
        inserted++;
      }
      return;
    });
    inserted += chunk.length;
  }

  const destCount = await countRows(supabase, 'bids', tableName);
  const status = destCount >= sourceCount ? '✓' : '⚠ MISMATCH';
  console.log(`     ${status}  source=${sourceCount}  dest=${destCount}`);
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

async function run() {
  console.log('=== Beisser Takeoff: Neon → Supabase data migration ===\n');

  // -------------------------------------------------------------------------
  // Legacy serial-ID tables (must follow FK dependency order)
  // -------------------------------------------------------------------------
  console.log('--- Legacy tables ---');

  await migrateTable('branch',     { pkColumn: 'branch_id' });
  await migrateTable('estimator',  { pkColumn: 'estimatorID' });
  await migrateTable('designer');
  await migrateTable('user_type');
  await migrateTable('user');
  await migrateTable('user_security', { pkColumn: 'user_type_id' });
  await migrateTable('customer');
  await migrateTable('job');
  await migrateTable('bid');
  await migrateTable('bid_file');
  await migrateTable('bid_field');
  await migrateTable('bid_value');
  await migrateTable('design');
  await migrateTable('projects');
  await migrateTable('ewp');
  await migrateTable('it_service');
  await migrateTable('login_activity');
  await migrateTable('bid_activity');
  await migrateTable('design_activity');
  // general_audit: changes column upgraded from TEXT to JSONB
  await migrateTable('general_audit', {
    transform: (row) => ({
      ...row,
      changes: row.changes
        ? (() => {
            try {
              return typeof row.changes === 'string'
                ? JSON.parse(row.changes)
                : row.changes;
            } catch {
              // Couldn't parse as JSON — wrap in a string value object
              return { raw: row.changes };
            }
          })()
        : null,
    }),
  });
  await migrateTable('notification_rule');
  await migrateTable('notification_log');

  // -------------------------------------------------------------------------
  // New UUID-based tables
  // -------------------------------------------------------------------------
  console.log('\n--- New UUID tables ---');

  await migrateTable('branches');
  await migrateTable('users');
  await migrateTable('customers');
  await migrateTable('bids');
  await migrateTable('bid_versions');
  await migrateTable('products');
  await migrateTable('multipliers');
  await migrateTable('assemblies');
  await migrateTable('assembly_items');
  await migrateTable('takeoff_sessions');
  await migrateTable('takeoff_viewports');
  await migrateTable('takeoff_groups');
  await migrateTable('takeoff_measurements');
  await migrateTable('takeoff_page_states');

  // -------------------------------------------------------------------------
  // Backfill legacy_id bridge columns
  // Populate users.legacy_id and customers.legacy_id by matching on email/code
  // so the unified tables can resolve legacy serial IDs to UUIDs.
  // -------------------------------------------------------------------------
  console.log('\n--- Backfilling legacy_id bridge columns ---');

  // users.legacy_id: match new UUID users to legacy serial users by email
  const { count: userUpdates } = await supabase`
    UPDATE bids.users u
    SET legacy_id = lu.id
    FROM bids."user" lu
    WHERE LOWER(u.email) = LOWER(lu.email)
      AND u.legacy_id IS NULL
    RETURNING u.id
  `.then((rows) => ({ count: rows.length }));
  console.log(`  → users.legacy_id backfilled: ${userUpdates} rows`);

  // customers.legacy_id: match new UUID customers to legacy serial customers by code
  const { count: custUpdates } = await supabase`
    UPDATE bids.customers c
    SET legacy_id = lc.id
    FROM bids.customer lc
    WHERE c.code = lc."customerCode"
      AND c.legacy_id IS NULL
    RETURNING c.id
  `.then((rows) => ({ count: rows.length }));
  console.log(`  → customers.legacy_id backfilled: ${custUpdates} rows`);

  // -------------------------------------------------------------------------
  // Final summary
  // -------------------------------------------------------------------------
  console.log('\n=== Migration complete ===');
  console.log('\nNext steps:');
  console.log('  1. Verify row counts in Supabase dashboard');
  console.log('  2. Apply db/migrations/0003c_legacy_fk_constraints.sql in Supabase SQL editor');
  console.log('  3. Test the app against the new BIDS_DATABASE_URL');
  console.log('  4. Update Vercel env vars: set BIDS_DATABASE_URL, remove old Neon DATABASE_URL');
  console.log('  5. Deploy to staging and smoke-test all pages');
  console.log('  6. After 2-week validation window, decommission Neon (set to read-only first)\n');

  await neon.end();
  await supabase.end();
}

run().catch((err) => {
  console.error('\nMigration failed:', err);
  neon.end();
  supabase.end();
  process.exit(1);
});
