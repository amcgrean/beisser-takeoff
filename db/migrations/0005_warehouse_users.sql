-- Migration: warehouse users support
-- Apply manually in Supabase SQL editor
--
-- 1. Make email nullable so yard/warehouse employees can be created without an email address.
--    (PostgreSQL allows multiple NULLs in a UNIQUE index — existing unique emails are unaffected.)
-- 2. Add is_warehouse boolean for picking/warehouse role (future user-based picking).

ALTER TABLE bids."user" ALTER COLUMN email DROP NOT NULL;

ALTER TABLE bids."user" ADD COLUMN IF NOT EXISTS is_warehouse boolean NOT NULL DEFAULT false;
