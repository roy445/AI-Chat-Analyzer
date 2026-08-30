-- AI Chat Analyzer: error simulation and real error history
-- Run once in the same PostgreSQL database used by DATABASE_URL.

CREATE TABLE IF NOT EXISTS error_test_history (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'test',
  message TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ NULL
);

ALTER TABLE error_test_history ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'test';
ALTER TABLE error_test_history ADD COLUMN IF NOT EXISTS message TEXT NULL;

CREATE INDEX IF NOT EXISTS error_test_history_started_at_idx ON error_test_history (started_at DESC);
CREATE INDEX IF NOT EXISTS error_test_history_active_idx ON error_test_history (code) WHERE stopped_at IS NULL;

-- If system_settings was created before the admin controls were added:
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS test_error_code TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS announcement_level TEXT NOT NULL DEFAULT 'info';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Restore normal operation manually:
-- UPDATE system_settings SET test_error_code = NULL, updated_at = NOW() WHERE id = 1;
-- UPDATE error_test_history SET stopped_at = NOW() WHERE stopped_at IS NULL AND source = 'test';
