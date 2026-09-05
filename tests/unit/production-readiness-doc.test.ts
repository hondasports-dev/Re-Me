import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production readiness checklist', () => {
  const checklist = readFileSync(resolve('docs/development/production-readiness.md'), 'utf8')

  it('keeps production writes behind Human Gate and records the no-import state', () => {
    expect(checklist).toContain('legacy-migration.md')
    expect(checklist).toContain('CLOUDFLARE_API_TOKEN')
    expect(checklist).toMatch(/Restore は Production への書き込みなので Human Gate/)
    expect(checklist).toContain('Preview へ Production data を流し込まない')
    expect(checklist).toContain('Production data は未投入')
  })

  it('covers backup, account recovery, export/delete, monitoring, and outage sweep', () => {
    expect(checklist).toContain('Production data は未投入で、migration export / import は不要や')
    expect(checklist).toContain('アカウント復旧 / provider 継続')
    expect(checklist).toContain('Data export / 削除')
    expect(checklist).toContain('processing lock timeout が再 claim されること')
    expect(checklist).toContain('Vendor outage')
    expect(checklist).toContain('Browser に出さない')
  })
})
