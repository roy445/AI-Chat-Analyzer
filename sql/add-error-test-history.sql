-- AI Chat Analyzer: error simulation history
-- Run once in the same PostgreSQL database used by DATABASE_URL.

CREATE TABLE IF NOT EXISTS error_test_history (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  severity TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS error_test_history_started_at_idx
  ON error_test_history (started_at DESC);

CREATE INDEX IF NOT EXISTS error_test_history_active_idx
  ON error_test_history (code)
  WHERE stopped_at IS NULL;

-- Optional one-time compatibility patch if system_settings was created earlier:
-- ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS test_error_code TEXT;
-- ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS announcement_level TEXT NOT NULL DEFAULT 'info';
-- ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Optional one-time usage log table if it does not already exist:
-- CREATE TABLE IF NOT EXISTS usage_events (
--   id SERIAL PRIMARY KEY,
--   event_type TEXT NOT NULL,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
-- CREATE INDEX IF NOT EXISTS usage_events_created_at_idx ON usage_events (created_at DESC);

-- To restore normal operation manually:
-- UPDATE system_settings SET test_error_code = NULL, updated_at = NOW() WHERE id = 1;
-- UPDATE error_test_history SET stopped_at = NOW()
-- WHERE stopped_at IS NULL;

-- Security note: this script does not create or change the admin password.
-- Keep ADMIN_PASSWORD and DATABASE_URL only in deployment environment variables.

