-- Page visit tracking for LiveEdge personalized homepage
-- Apply in Supabase SQL editor

CREATE TABLE IF NOT EXISTS bids.page_visits (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT        NOT NULL,
  path            TEXT        NOT NULL,
  visit_count     INTEGER     NOT NULL DEFAULT 1,
  last_visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, path)
);

CREATE INDEX IF NOT EXISTS idx_page_visits_user_count
  ON bids.page_visits (user_id, visit_count DESC);
