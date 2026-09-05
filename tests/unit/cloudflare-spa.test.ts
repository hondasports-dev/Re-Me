import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Cloudflare SPA hosting', () => {
  it('keeps Workers Static Assets in SPA fallback mode', () => {
    const wrangler = readFileSync(resolve('wrangler.jsonc'), 'utf8')

    expect(wrangler).toContain('"not_found_handling": "single-page-application"')
    expect(wrangler).toContain('run_worker_first')
    expect(wrangler).toContain('/api/*')
  })

  it('keeps local, Preview, and Production Worker names separate', () => {
    const wrangler = readFileSync(resolve('wrangler.jsonc'), 'utf8')
    const previewStart = wrangler.indexOf('"preview"')
    const productionStart = wrangler.indexOf('"production"')
    const previewConfig = wrangler.slice(previewStart, productionStart)

    expect(wrangler).toContain('"name": "re-me-local"')
    expect(wrangler).toContain('"preview"')
    expect(wrangler).toContain('"name": "re-me-preview"')
    expect(wrangler).toContain('"workers_dev": true')
    expect(previewConfig).toContain('"preview_urls": false')
    expect(wrangler).toMatch(/"production"\s*:\s*\{/)
    expect(wrangler).toContain('"name": "re-me"')
    expect(wrangler).toContain('"preview_urls": false')
  })

  it('exposes Preview deploy secrets only after workflow steps begin', () => {
    const workflow = readFileSync(resolve('.github/workflows/preview.yml'), 'utf8')
    const stepsStart = workflow.indexOf('\n    steps:')
    const frontendBuild = workflow.indexOf('pnpm build:preview')
    const firstCloudflareKey = workflow.indexOf('CLOUDFLARE_API_TOKEN')

    expect(stepsStart).toBeGreaterThan(0)
    expect(frontendBuild).toBeGreaterThan(stepsStart)
    expect(firstCloudflareKey).toBeGreaterThan(frontendBuild)

    for (const secretName of ['CLOUDFLARE_API_TOKEN']) {
      const occurrences = [...workflow.matchAll(new RegExp(secretName, 'g'))]

      expect(occurrences.length).toBeGreaterThan(0)
      expect(occurrences.every(({ index }) => index !== undefined && index > stepsStart)).toBe(true)
    }
  })

  it('builds Preview before loading the Cloudflare deploy credential', () => {
    const packageJson = readFileSync(resolve('package.json'), 'utf8')
    const deployScript = JSON.parse(packageJson).scripts['deploy:preview'] as string

    expect(deployScript).toBe('pnpm build:preview && node scripts/cloudflare-deploy.mjs preview')
  })

  it('sets long-lived cache headers for hashed Vite assets', () => {
    const headers = readFileSync(resolve('public/_headers'), 'utf8')

    expect(headers).toContain('/assets/*')
    expect(headers).toContain('Cache-Control: public, max-age=31536000, immutable')
    expect(headers).toContain('/sw.js')
    expect(headers).toContain('Cache-Control: no-cache')
  })
})
