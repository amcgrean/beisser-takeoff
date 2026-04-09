-- Migration: receiving_yard role
-- Apply manually in Supabase SQL editor

ALTER TABLE bids."user" ADD COLUMN IF NOT EXISTS is_receiving_yard boolean NOT NULL DEFAULT false;
