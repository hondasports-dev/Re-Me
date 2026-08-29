import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production readiness checklist', () => {
  const checklist = readFileSync(resolve('docs/development/production-readiness.md'), 'utf8')

  it('keeps production writes behind Human Gate and links migration rehearsal', () => {
    expect(checklist).toContain('Issue #38')
    expect(checklist).toContain('legacy-migration.md')
    expect(checklist).toContain('CONVEX_PREVIEW_DEPLOY_KEY')
    expect(checklist).toMatch(/Restore は production への書き込みなので Human Gate/)
    expect(checklist).toContain('Preview へ production export を流し込まない')
    expect(checklist).not.toMatch(/convex deploy --prod/)
  })

  it('covers backup, account recovery, export/delete, monitoring, and outage sweep', () => {
    expect(checklist).toContain('git に production dump を置かない')
    expect(checklist).toContain('アカウント復旧 / provider 継続')
    expect(checklist).toContain('Data export / 削除')
    expect(checklist).toMatch(
      /claim は `pending` → `failed` → `processing` の順で、各 status 内だけ `availableAt` の古い順/,
    )
    expect(checklist).toContain('Vendor outage')
    expect(checklist).toContain('Browser に出さない')
  })
})
