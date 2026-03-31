-- Add legacy_bid_id to takeoff_sessions so a takeoff can be linked to a
-- legacy bid-tracker bid (integer FK to the Alembic-managed "bid" table).
-- No ON DELETE cascade — legacy bids are managed separately.
ALTER TABLE "takeoff_sessions"
  ADD COLUMN IF NOT EXISTS "legacy_bid_id" integer;

CREATE INDEX IF NOT EXISTS "takeoff_sessions_legacy_bid_idx"
  ON "takeoff_sessions" ("legacy_bid_id");
