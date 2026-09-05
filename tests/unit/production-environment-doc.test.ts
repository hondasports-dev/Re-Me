import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production environment runbook', () => {
  const runbook = readFileSync(resolve('docs/development/production-environment.md'), 'utf8')
  const gitignore = readFileSync(resolve('.gitignore'), 'utf8')
  const packageJson = readFileSync(resolve('package.json'), 'utf8')

  it('does not create live production resources from the runbook itself', () => {
    expect(runbook).toContain('この文書を読んでも Auth0 / Cloudflare の本番リソースは作らない')
    expect(runbook).toContain('Human Gate')
    expect(runbook).toContain('https://re-me.hondasports.workers.dev')
    expect(runbook).toContain('https://re-me-preview.hondasports.workers.dev')
    expect(runbook).toContain('Auth0 PROD')
    expect(runbook).toContain('CLOUDFLARE_API_TOKEN')
    expect(runbook).toContain('re-me-production-attachments')
    expect(runbook).toContain('pnpm deploy:production')
    expect(runbook).toContain('legacy data import')
    expect(runbook).toContain('Production deploy は未実施')
    expect(runbook).toContain('業務 data は未投入')
  })

  it('keeps production example env files committable and out of the default deploy script', () => {
    expect(gitignore).toContain('!.env.production.example')
    expect(readFileSync(resolve('.env.production.example'), 'utf8')).toContain(
      'CLOUDFLARE_ENV=production',
    )
    expect(JSON.parse(packageJson).scripts.deploy).toBe('pnpm deploy:preview')
    expect(JSON.parse(packageJson).scripts['build:production']).toBe(
      'node scripts/cloudflare-build.mjs production',
    )
    expect(JSON.parse(packageJson).scripts['deploy:production']).toContain('pnpm build:production')
  })
})
