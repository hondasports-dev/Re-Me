-- Re:Me Cloudflare D1 target schema.
--
-- All instants are epoch milliseconds (UTC). The application never exposes
-- letter_deliveries.scheduled_at through a browser-facing projection.
-- Convex document IDs are retained as TEXT IDs so a rehearsal can prove every
-- relationship without guessing a new identifier mapping.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  token_identifier TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  picture_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL,
  push_enabled INTEGER NOT NULL CHECK (push_enabled IN (0, 1)),
  email_notification_enabled INTEGER NOT NULL CHECK (email_notification_enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS letters (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_letter_id TEXT REFERENCES letters(id) ON DELETE RESTRICT,
  next_letter_id TEXT REFERENCES letters(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'traveling', 'delivered')),
  sealed INTEGER NOT NULL CHECK (sealed IN (0, 1)),
  delivery_mode TEXT CHECK (delivery_mode IN ('few_days', 'few_weeks', 'few_months', 'about_year', 'surprise')),
  delivery_window_start INTEGER,
  delivery_window_end INTEGER,
  sent_at INTEGER,
  delivered_at INTEGER,
  opened_at INTEGER,
  replied_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  CHECK (parent_letter_id IS NULL OR parent_letter_id <> id),
  CHECK (delivery_window_start IS NULL OR delivery_window_end IS NULL OR delivery_window_start <= delivery_window_end),
  CHECK (
    (status = 'draft'
      AND sent_at IS NULL
      AND delivered_at IS NULL
      AND delivery_mode IS NULL
      AND delivery_window_start IS NULL
      AND delivery_window_end IS NULL)
    OR
    (status = 'traveling'
      AND sent_at IS NOT NULL
      AND delivered_at IS NULL
      AND delivery_mode IS NOT NULL
      AND delivery_window_start IS NOT NULL
      AND delivery_window_end IS NOT NULL)
    OR
    (status = 'delivered'
      AND sent_at IS NOT NULL
      AND delivered_at IS NOT NULL
      AND delivery_mode IS NOT NULL
      AND delivery_window_start IS NOT NULL
      AND delivery_window_end IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS letter_contents (
  letter_id TEXT PRIMARY KEY NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) <= 20000),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS letters_active_parent_unique_idx
  ON letters(parent_letter_id)
  WHERE parent_letter_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS letter_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  letter_id TEXT NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photo', 'location')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'deleting')),
  r2_object_key TEXT,
  upload_r2_object_key TEXT,
  content_etag TEXT,
  mime_type TEXT,
  byte_size INTEGER CHECK (byte_size IS NULL OR byte_size >= 0),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  generation_token TEXT,
  upload_expires_at INTEGER,
  delete_attempt_count INTEGER CHECK (delete_attempt_count IS NULL OR delete_attempt_count >= 0),
  next_reconcile_at INTEGER,
  last_error_code TEXT,
  location_label TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (kind = 'photo' AND location_label IS NULL)
    OR
    (kind = 'location' AND location_label IS NOT NULL AND r2_object_key IS NULL AND upload_r2_object_key IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS attachment_finalization_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  attachment_id TEXT NOT NULL REFERENCES letter_attachments(id) ON DELETE CASCADE,
  generation_token TEXT NOT NULL,
  runner_token TEXT NOT NULL,
  object_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('claimed', 'winner', 'deleting')),
  delete_attempt_count INTEGER NOT NULL CHECK (delete_attempt_count >= 0),
  next_reconcile_at INTEGER,
  retire_after INTEGER,
  last_error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- This table is intentionally internal. scheduled_at is never selected by a
-- browser route, even though D1 itself has no separate schema namespace.
CREATE TABLE IF NOT EXISTS letter_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  letter_id TEXT NOT NULL UNIQUE REFERENCES letters(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at INTEGER NOT NULL CHECK (scheduled_at >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'consumed', 'canceled')),
  attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
  last_attempt_at INTEGER,
  created_at INTEGER NOT NULL
);

-- This is an outbox, not a delivery status. Queue retries update this row and
-- never roll a delivered letter back to traveling.
CREATE TABLE IF NOT EXISTS notification_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  letter_id TEXT NOT NULL UNIQUE REFERENCES letters(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
  generation_token TEXT NOT NULL,
  available_at INTEGER NOT NULL CHECK (available_at >= 0),
  locked_at INTEGER,
  sent_at INTEGER,
  last_error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  disabled_at INTEGER
);

-- One row per source document. A changed source document must fail with
-- checksum drift instead of silently being skipped on a rerun.
CREATE TABLE IF NOT EXISTS migration_import_keys (
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  source_checksum TEXT NOT NULL,
  imported_at INTEGER NOT NULL,
  PRIMARY KEY (source_table, source_id)
);

CREATE INDEX IF NOT EXISTS users_token_identifier_idx
  ON users(token_identifier);

CREATE INDEX IF NOT EXISTS user_settings_user_idx
  ON user_settings(user_id);

CREATE INDEX IF NOT EXISTS threads_owner_updated_idx
  ON threads(owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS letters_owner_status_deleted_updated_idx
  ON letters(owner_id, status, deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS letters_thread_sent_idx
  ON letters(thread_id, sent_at ASC);

CREATE INDEX IF NOT EXISTS letters_parent_idx
  ON letters(parent_letter_id);

CREATE INDEX IF NOT EXISTS letters_next_idx
  ON letters(next_letter_id);

CREATE INDEX IF NOT EXISTS letter_contents_letter_idx
  ON letter_contents(letter_id);

CREATE INDEX IF NOT EXISTS letter_attachments_letter_idx
  ON letter_attachments(letter_id);

CREATE INDEX IF NOT EXISTS letter_attachments_status_upload_expiry_idx
  ON letter_attachments(status, upload_expires_at);

CREATE INDEX IF NOT EXISTS letter_attachments_status_reconcile_idx
  ON letter_attachments(status, next_reconcile_at);

CREATE INDEX IF NOT EXISTS finalization_attempts_attachment_state_idx
  ON attachment_finalization_attempts(attachment_id, state);

CREATE INDEX IF NOT EXISTS finalization_attempts_state_reconcile_idx
  ON attachment_finalization_attempts(state, next_reconcile_at);

CREATE INDEX IF NOT EXISTS letter_deliveries_due_idx
  ON letter_deliveries(status, scheduled_at);

CREATE INDEX IF NOT EXISTS notification_jobs_ready_idx
  ON notification_jobs(status, available_at);

CREATE INDEX IF NOT EXISTS push_subscriptions_owner_disabled_idx
  ON push_subscriptions(owner_id, disabled_at);

CREATE INDEX IF NOT EXISTS migration_import_keys_target_idx
  ON migration_import_keys(target_id);

CREATE TRIGGER IF NOT EXISTS migration_import_keys_checksum_immutable
BEFORE UPDATE OF source_checksum ON migration_import_keys
WHEN OLD.source_checksum IS NOT NEW.source_checksum
BEGIN
  SELECT RAISE(ABORT, 'migration_checksum_drift');
END;

CREATE TRIGGER IF NOT EXISTS migration_import_keys_target_immutable
BEFORE UPDATE OF target_id ON migration_import_keys
WHEN OLD.target_id IS NOT NEW.target_id
BEGIN
  SELECT RAISE(ABORT, 'migration_target_mapping_drift');
END;

-- Database-level guards complement Worker authorization. The Worker is the
-- only supported writer for lifecycle changes; these guards protect the
-- immutable parts if an operator uses a D1 console during a rehearsal.
CREATE TRIGGER IF NOT EXISTS letter_contents_immutable_after_send
BEFORE UPDATE ON letter_contents
WHEN EXISTS (
  SELECT 1 FROM letters
  WHERE id = OLD.letter_id AND status <> 'draft'
)
AND (
  OLD.letter_id IS NOT NEW.letter_id
  OR OLD.owner_id IS NOT NEW.owner_id
  OR OLD.body IS NOT NEW.body
)
BEGIN
  SELECT RAISE(ABORT, 'sent_letter_content_immutable');
END;

CREATE TRIGGER IF NOT EXISTS letter_attachments_immutable_after_send
BEFORE UPDATE ON letter_attachments
WHEN EXISTS (
  SELECT 1 FROM letters
  WHERE id = OLD.letter_id AND status <> 'draft'
)
AND (
  OLD.letter_id IS NOT NEW.letter_id
  OR OLD.owner_id IS NOT NEW.owner_id
  OR OLD.kind IS NOT NEW.kind
  OR OLD.r2_object_key IS NOT NEW.r2_object_key
  OR OLD.content_etag IS NOT NEW.content_etag
  OR OLD.mime_type IS NOT NEW.mime_type
  OR OLD.byte_size IS NOT NEW.byte_size
  OR OLD.width IS NOT NEW.width
  OR OLD.height IS NOT NEW.height
  OR OLD.generation_token IS NOT NEW.generation_token
  OR OLD.location_label IS NOT NEW.location_label
)
BEGIN
  SELECT RAISE(ABORT, 'sent_letter_attachment_immutable');
END;

CREATE TRIGGER IF NOT EXISTS letters_immutable_fields_after_send
BEFORE UPDATE ON letters
WHEN OLD.status <> 'draft'
  AND (
    OLD.thread_id IS NOT NEW.thread_id
    OR OLD.owner_id IS NOT NEW.owner_id
    OR OLD.parent_letter_id IS NOT NEW.parent_letter_id
    OR OLD.sealed IS NOT NEW.sealed
    OR OLD.delivery_mode IS NOT NEW.delivery_mode
    OR OLD.delivery_window_start IS NOT NEW.delivery_window_start
    OR OLD.delivery_window_end IS NOT NEW.delivery_window_end
    OR OLD.sent_at IS NOT NEW.sent_at
  )
BEGIN
  SELECT RAISE(ABORT, 'sent_letter_immutable');
END;
