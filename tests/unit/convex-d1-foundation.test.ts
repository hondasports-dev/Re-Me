import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Cloudflare D1 migration foundation', () => {
  const wrangler = readFileSync(resolve('wrangler.jsonc'), 'utf8')
  const runbook = readFileSync(resolve('docs/development/convex-d1-migration.md'), 'utf8')
  const adr = readFileSync(
    resolve('docs/architecture/decisions/0010-cloudflare-d1-migration-foundation.md'),
    'utf8',
  )
  const gitignore = readFileSync(resolve('.gitignore'), 'utf8')

  it('keeps D1, R2, Queue, and Cron resources separated by environment', () => {
    expect(wrangler).toContain('"database_name": "re-me-local"')
    expect(wrangler).toContain('"database_name": "re-me-preview"')
    expect(wrangler).toContain('"database_name": "re-me"')
    expect(wrangler).toContain('"bucket_name": "re-me-local-attachments"')
    expect(wrangler).toContain('"bucket_name": "re-me-preview-attachments"')
    expect(wrangler).toContain('"bucket_name": "re-me-production-attachments"')
    expect(wrangler).toContain('re-me-local-notifications')
    expect(wrangler).toContain('re-me-preview-notifications')
    expect(wrangler).toContain('re-me-production-notifications')
    expect(wrangler).toMatch(/"crons": \["\*\/5 \* \* \* \*"\]/)
    expect(wrangler).toContain('"database_id": "d688b3a0-a948-4f9e-9e21-49050e2f79c8"')
    expect(wrangler).toContain('"database_id": "e129d7d0-2f45-4b17-9ebb-0eb5f781498f"')
    expect(wrangler).not.toContain('CLOUDFLARE_API_TOKEN')
  })

  it('documents dry-run, private data, rollback, and the production gate', () => {
    for (const document of [runbook, adr]) {
      expect(document).toContain('Human Gate')
      expect(document).toContain('dry-run')
      expect(document).toContain('R2')
      expect(document).toContain('rollback')
    }
    expect(runbook).toContain('migration_import_keys')
    expect(runbook).toContain('scheduledAt')
    expect(gitignore).toContain('migration-artifacts/')
    expect(gitignore).toContain('*.convex-export*')
  })
})
