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

  it('sets long-lived cache headers for hashed Vite assets', () => {
    const headers = readFileSync(resolve('public/_headers'), 'utf8')

    expect(headers).toContain('/assets/*')
    expect(headers).toContain('Cache-Control: public, max-age=31536000, immutable')
  })
})
