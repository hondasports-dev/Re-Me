import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production readiness checklist', () => {
  const checklist = readFileSync(resolve('docs/development/production-readiness.md'), 'utf8')

  it('keeps production writes behind Human Gate and links migration rehearsal', () => {
    expect(checklist).toContain('Issue #38')
    expect(checklist).toContain('legacy-migration.md')
    expect(checklist).toContain('CONVEX_PREVIEW_DEPLOY_KEY')
    expect(checklist).not.toMatch(/convex deploy --prod/)
  })

  it('covers backup, account recovery, export/delete, monitoring, and outage sweep', () => {
    expect(checklist).toContain('Backup / export / restore')
    expect(checklist).toContain('アカウント復旧')
    expect(checklist).toContain('Data export / 削除')
    expect(checklist).toContain('最古の')
    expect(checklist).toContain('Vendor outage')
    expect(checklist).toContain('Browser に出さない')
  })
})
