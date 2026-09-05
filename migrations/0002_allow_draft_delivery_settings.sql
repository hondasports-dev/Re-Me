-- Drafts keep the user's sealed/delivery choice before they are sent.
-- The original table check accidentally required delivery_mode to be NULL for
-- drafts, which made the normal settings-save request fail. Rebuild only the
-- affected table so existing IDs and rows remain unchanged.

PRAGMA foreign_keys = OFF;

-- SQLite invalidates triggers on the child tables when their referenced table
-- is rebuilt, so remove and recreate those guards around the table swap.
DROP TRIGGER IF EXISTS letter_contents_immutable_after_send;
DROP TRIGGER IF EXISTS letter_attachments_immutable_after_send;
DROP TRIGGER IF EXISTS letters_immutable_fields_after_send;

CREATE TABLE letters_new (
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

INSERT INTO letters_new (
  id, thread_id, owner_id, parent_letter_id, next_letter_id, status, sealed,
  delivery_mode, delivery_window_start, delivery_window_end, sent_at,
  delivered_at, opened_at, replied_at, created_at, updated_at, deleted_at
)
SELECT
  id, thread_id, owner_id, parent_letter_id, next_letter_id, status, sealed,
  delivery_mode, delivery_window_start, delivery_window_end, sent_at,
  delivered_at, opened_at, replied_at, created_at, updated_at, deleted_at
FROM letters;

DROP TABLE letters;
ALTER TABLE letters_new RENAME TO letters;

CREATE UNIQUE INDEX letters_active_parent_unique_idx
  ON letters(parent_letter_id)
  WHERE parent_letter_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX letters_owner_status_deleted_updated_idx
  ON letters(owner_id, status, deleted_at, updated_at DESC);

CREATE INDEX letters_thread_sent_idx
  ON letters(thread_id, sent_at ASC);

CREATE INDEX letters_parent_idx
  ON letters(parent_letter_id);

CREATE INDEX letters_next_idx
  ON letters(next_letter_id);

CREATE TRIGGER letters_immutable_fields_after_send
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

CREATE TRIGGER letter_contents_immutable_after_send
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

CREATE TRIGGER letter_attachments_immutable_after_send
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

PRAGMA foreign_keys = ON;
