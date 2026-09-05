import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

const expectedTables = [
  'users',
  'user_settings',
  'threads',
  'letters',
  'letter_contents',
  'letter_attachments',
  'attachment_finalization_attempts',
  'letter_deliveries',
  'notification_jobs',
  'push_subscriptions',
  'migration_import_keys',
]

const expectedIndexes = [
  'letters_active_parent_unique_idx',
  'letters_parent_idx',
  'letter_deliveries_due_idx',
  'notification_jobs_ready_idx',
  'migration_import_keys_target_idx',
]

describe('D1 migration schema', () => {
  it('applies all target tables and migration guards to the local binding', async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).all<{ name: string }>()

    expect(result.results.map((row) => row.name)).toEqual(expect.arrayContaining(expectedTables))

    const indexes = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).all<{ name: string }>()
    expect(indexes.results.map((row) => row.name)).toEqual(expect.arrayContaining(expectedIndexes))

    const triggers = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE '%immutable%' ORDER BY name",
    ).all<{ name: string }>()
    expect(triggers.results.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        'letter_contents_immutable_after_send',
        'letter_attachments_immutable_after_send',
        'letters_immutable_fields_after_send',
        'migration_import_keys_checksum_immutable',
        'migration_import_keys_target_immutable',
      ]),
    )
  })

  it('enforces ownership foreign keys and sent content immutability', async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (id, token_identifier, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
      ).bind('user-1', 'auth0|user-1', 1, 1),
      env.DB.prepare(
        `INSERT INTO threads (id, owner_id, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
      ).bind('thread-1', 'user-1', 1, 1),
      env.DB.prepare(
        `INSERT INTO letters (
          id, thread_id, owner_id, status, sealed, delivery_mode,
          delivery_window_start, delivery_window_end, sent_at, delivered_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, 'delivered', 1, 'few_days', ?, ?, ?, ?, ?, ?)`,
      ).bind('letter-1', 'thread-1', 'user-1', 2, 3, 1, 4, 1, 1),
      env.DB.prepare(
        `INSERT INTO letter_contents (letter_id, owner_id, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind('letter-1', 'user-1', 'body', 1, 1),
    ])

    await expect(
      env.DB.prepare('UPDATE letter_contents SET body = ? WHERE letter_id = ?')
        .bind('changed', 'letter-1')
        .run(),
    ).rejects.toThrow()
    await expect(
      env.DB.prepare(
        `INSERT INTO threads (id, owner_id, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
      )
        .bind('orphan-thread', 'missing-user', 1, 1)
        .run(),
    ).rejects.toThrow()
  })
})
