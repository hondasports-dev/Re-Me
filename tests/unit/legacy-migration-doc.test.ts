import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('legacy migration playbook', () => {
  const playbook = readFileSync(resolve('docs/development/legacy-migration.md'), 'utf8')

  it('records current inventory and a reproducible non-production dry-run', () => {
    expect(playbook).toContain('no_production_import')
    expect(playbook).toContain('Issue #38')
    expect(playbook).toContain('Preview Convex への dry-run import は **しない**')
    expect(playbook).toContain('pnpm db:start')
  })

  it('keeps rollback, retain/cleanup, and Human Gate separate from local compare', () => {
    expect(playbook).toContain('Rollback')
    expect(playbook).toContain('Cleanup vs 保持')
    expect(playbook).toContain('Production export / import')
    expect(playbook).toContain('irreversible credential / project deletion')
    expect(playbook).not.toMatch(/convex deploy --prod/)
  })
})
