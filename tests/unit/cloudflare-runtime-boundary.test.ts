// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function listFiles(relativePath: string): string[] {
  const absolutePath = path.join(repoRoot, relativePath)
  if (!existsSync(absolutePath)) return []
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = path.join(relativePath, entry.name)
    return entry.isDirectory() ? listFiles(childPath) : [childPath]
  })
}

describe('CI and Cloudflare Worker boundary', () => {
  const ci = readRepoFile('.github/workflows/ci.yml')
  const preview = readRepoFile('.github/workflows/preview.yml')
  const packageJson = readRepoFile('package.json')
  const gitignore = readRepoFile('.gitignore')
  const tsconfig = readRepoFile('tsconfig.json')

  it('runs only Worker backend tests in the Quality gates job', () => {
    const quality = ci.slice(ci.indexOf('name: Quality gates'), ci.indexOf('name: End-to-end'))
    expect(quality).toContain('pnpm test:worker')
    expect(quality).not.toMatch(/convex/i)
    expect(packageJson).not.toMatch(/convex/i)
    expect(tsconfig).not.toMatch(/convex/i)
  })

  it('removes legacy Convex runtime artifacts from the repository', () => {
    for (const relativePath of ['convex', 'tests/convex']) {
      expect(listFiles(relativePath)).toEqual([])
    }
    for (const relativePath of [
      'convex.json',
      'vitest.convex.config.ts',
      '.env.convex-preview.example',
      '.env.convex-production.example',
    ]) {
      expect(existsSync(path.join(repoRoot, relativePath))).toBe(false)
    }
    expect(gitignore).not.toMatch(/(^|\n)\.convex\/(\n|$)/)
  })

  it('deploys the PR checkout to shared Preview Worker before Playwright', () => {
    const e2e = ci.slice(ci.indexOf('name: End-to-end'))
    expect(e2e).toContain('environment: preview')
    expect(e2e).toContain('needs: quality')
    expect(e2e).toContain('group: shared-preview-backend')
    expect(e2e).toContain('cancel-in-progress: false')
    expect(e2e).toContain('CLOUDFLARE_API_TOKEN')
    expect(e2e).toContain('pnpm deploy:preview')
    const deploy = e2e.indexOf('name: Deploy Cloudflare Preview')
    const playwright = e2e.indexOf('name: End-to-end tests')
    expect(deploy).toBeGreaterThan(-1)
    expect(playwright).toBeGreaterThan(deploy)
    expect(e2e).toContain('pnpm test:e2e')
    expect(e2e).toMatch(/VITE_API_BASE_URL: \$\{{\s*vars\.PREVIEW_BASE_URL\s*}}/)
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

  it('serializes Preview frontend deploys with CI E2E backend deploys', () => {
    expect(preview).toContain('group: shared-preview-backend')
    expect(preview).toContain('cancel-in-progress: false')
  })

  it('does not send production Worker deploy through PR CI or Preview', () => {
    expect(ci).not.toContain('wrangler deploy --env production')
    expect(preview).not.toContain('wrangler deploy --env production')
    expect(preview).toContain('environment: preview')
    expect(preview).toContain('secrets.CLOUDFLARE_API_TOKEN')
    expect(ci).toContain('secrets.CLOUDFLARE_API_TOKEN')
    expect(ci).not.toContain('environment: production')
    expect(preview).not.toContain('environment: production')
  })
})
