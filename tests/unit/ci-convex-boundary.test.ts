// @vitest-environment node

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

describe('CI and local Convex boundary', () => {
  const ci = readRepoFile('.github/workflows/ci.yml')
  const preview = readRepoFile('.github/workflows/preview.yml')
  const packageJson = readRepoFile('package.json')
  const gitignore = readRepoFile('.gitignore')

  it('keeps Quality gates off the live Convex cloud', () => {
    const quality = ci.slice(ci.indexOf('name: Quality gates'), ci.indexOf('name: End-to-end'))
    expect(quality).toContain('pnpm test:convex')
    expect(quality).not.toContain('convex deploy')
    expect(quality).not.toContain('CONVEX_DEPLOY_KEY')
    expect(quality).not.toContain('VITE_CONVEX_URL')
  })

  it('deploys the PR checkout to shared Preview Convex before Playwright', () => {
    const e2e = ci.slice(ci.indexOf('name: End-to-end'))
    expect(e2e).toContain('environment: preview')
    expect(e2e).toContain('needs: quality')
    expect(e2e).toContain('group: shared-preview-backend')
    expect(e2e).toContain('cancel-in-progress: false')
    expect(e2e).toContain('CONVEX_PREVIEW_DEPLOY_KEY')
    expect(e2e).toContain('pnpm exec convex deploy')
    expect(e2e).toContain('pnpm test:e2e')
    expect(e2e).toMatch(/VITE_CONVEX_URL: \$\{{\s*vars\.VITE_CONVEX_URL\s*}}/)
  })

  it('does not put the Preview deploy key into the Playwright step', () => {
    const e2e = ci.slice(ci.indexOf('name: End-to-end'))
    const playwright = e2e.slice(e2e.indexOf('name: End-to-end tests'))
    expect(playwright).toContain('pnpm test:e2e')
    expect(playwright).not.toContain('CONVEX_DEPLOY_KEY')
    expect(playwright).not.toContain('CONVEX_PREVIEW_DEPLOY_KEY')
  })

  it('serializes Preview frontend deploys with CI E2E backend deploys', () => {
    expect(preview).toContain('group: shared-preview-backend')
    expect(preview).toContain('cancel-in-progress: false')
  })

  it('points local Convex scripts at the local backend wrapper', () => {
    expect(packageJson).toContain('"convex:dev": "node scripts/convex-dev-target.mjs"')
    expect(packageJson).toContain(
      '"dev:full": "node scripts/convex-dev-target.mjs --start \\"vite dev\\""',
    )
    expect(packageJson).toContain('"convex:check": "node scripts/convex-dev-target.mjs --once"')
  })

  it('ignores local Convex backend state', () => {
    expect(gitignore).toMatch(/(^|\n)\.convex\/(\n|$)/)
  })
})
