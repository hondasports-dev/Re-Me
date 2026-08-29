import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production environment runbook', () => {
  const runbook = readFileSync(resolve('docs/development/production-environment.md'), 'utf8')
  const gitignore = readFileSync(resolve('.gitignore'), 'utf8')
  const packageJson = readFileSync(resolve('package.json'), 'utf8')

  it('does not create live production resources from the runbook itself', () => {
    expect(runbook).toContain(
      'この文書を読んでも Auth0 / Convex / Cloudflare の本番リソースは作らない',
    )
    expect(runbook).toContain('Human Gate')
    expect(runbook).toContain('https://re-me.hondasports.workers.dev')
    expect(runbook).toContain('https://re-me-preview.hondasports.workers.dev')
    expect(runbook).toContain('Re:Me PROD')
    expect(runbook).toContain('CONVEX_PRODUCTION_DEPLOY_KEY')
    expect(runbook).toContain('CONVEX_PREVIEW_DEPLOY_KEY')
    expect(runbook).toContain('re-me-production-attachments')
    expect(runbook).not.toMatch(/convex deploy --prod/)
  })

  it('keeps production example env files committable and out of the default deploy script', () => {
    expect(gitignore).toContain('!.env.production.example')
    expect(gitignore).toContain('!.env.convex-production.example')
    expect(readFileSync(resolve('.env.production.example'), 'utf8')).toContain(
      'CLOUDFLARE_ENV=production',
    )
    expect(readFileSync(resolve('.env.convex-production.example'), 'utf8')).toContain(
      'Preview key は入れない',
    )
    expect(JSON.parse(packageJson).scripts.deploy).toBe('pnpm deploy:preview')
    expect(JSON.parse(packageJson).scripts).not.toHaveProperty('deploy:production')
  })
})
