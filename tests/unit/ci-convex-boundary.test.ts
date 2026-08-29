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
    expect(e2e).toContain('pnpm exec convex env set E2E_FORCE_DELIVERY 1')
    expect(e2e).toContain('pnpm test:e2e')
    expect(e2e).toMatch(/VITE_CONVEX_URL: \$\{{\s*vars\.VITE_CONVEX_URL\s*}}/)
  })

  it('documents both CI jobs as required merge checks', () => {
    const required = JSON.parse(readRepoFile('ops/required-status-checks.json')) as {
      ruleset: string
      contexts: string[]
    }
    const qualityGates = readRepoFile('docs/development/quality-gates.md')
    const previewEnv = readRepoFile('docs/development/preview-environment.md')

    expect(required.ruleset).toBe('protectmain')
    expect(required.contexts).toEqual(['Quality gates', 'End-to-end'])
    for (const context of required.contexts) {
      expect(ci).toContain(`name: ${context}`)
      expect(qualityGates).toContain(context)
      expect(previewEnv).toContain(context)
    }
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

  it('lets CI Playwright upload photos to the Preview R2 bucket', () => {
    const cors = JSON.parse(readRepoFile('ops/r2-cors-preview.json')) as {
      rules: Array<{
        allowed: { origins: string[]; methods: string[]; headers: string[] }
      }>
    }
    const origins = cors.rules[0]?.allowed.origins ?? []
    expect(origins).toContain('https://re-me-preview.hondasports.workers.dev')
    expect(origins).toContain('http://127.0.0.1:4173')
    expect(origins).toContain('http://localhost:4173')
    expect(cors.rules[0]?.allowed.methods).toEqual(['PUT', 'GET', 'HEAD'])
    expect(cors.rules[0]?.allowed.headers).toEqual([
      'Content-Type',
      'Content-Length',
      'If-None-Match',
    ])
    expect(readRepoFile('playwright.config.ts')).toContain("baseURL: 'http://127.0.0.1:4173'")
  })
})
