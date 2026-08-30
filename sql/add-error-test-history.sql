-- AI Chat Analyzer: error, announcement and usage history
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

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id SERIAL PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS feedback_submissions_fingerprint_idx ON feedback_submissions (fingerprint, created_at DESC);

CREATE TABLE IF NOT EXISTS announcement_history (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL
);
ALTER TABLE announcement_history ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS announcement_history_created_at_idx ON announcement_history (created_at DESC);
CREATE INDEX IF NOT EXISTS announcement_history_active_idx ON announcement_history (created_at DESC) WHERE revoked_at IS NULL;

ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS session_id TEXT NULL;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS page TEXT NULL;
CREATE INDEX IF NOT EXISTS usage_events_created_at_idx ON usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_session_idx ON usage_events (session_id, created_at DESC);

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS test_error_code TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS announcement_expires_at TIMESTAMPTZ NULL;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS announcement_level TEXT NOT NULL DEFAULT 'info';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Restore normal operation manually:
-- UPDATE system_settings SET test_error_code = NULL, announcement = NULL, announcement_level = 'info', updated_at = NOW() WHERE id = 1;
-- UPDATE error_test_history SET stopped_at = NOW() WHERE stopped_at IS NULL AND source = 'test';
-- UPDATE announcement_history SET revoked_at = NOW() WHERE revoked_at IS NULL;
