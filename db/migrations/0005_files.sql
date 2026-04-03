-- Generic file attachments table
-- Apply manually in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS bids.files (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT        NOT NULL,   -- e.g. 'legacy_bid', 'ewp', 'po', 'project'
  entity_id    TEXT        NOT NULL,
  file_name    TEXT        NOT NULL,
  r2_key       TEXT        NOT NULL UNIQUE,
  content_type TEXT        NOT NULL DEFAULT 'application/octet-stream',
  file_size    BIGINT,
  uploaded_by  INTEGER,                -- bids."user".id
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_entity ON bids.files (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON bids.files (uploaded_by);
