-- Legacy-to-D1 import bookkeeping is retired because Preview has no legacy
-- production dataset and Cloudflare Worker/D1 is now the only runtime.
DROP TRIGGER IF EXISTS migration_import_keys_checksum_immutable;
DROP TRIGGER IF EXISTS migration_import_keys_target_immutable;
DROP INDEX IF EXISTS migration_import_keys_target_idx;
DROP TABLE IF EXISTS migration_import_keys;
