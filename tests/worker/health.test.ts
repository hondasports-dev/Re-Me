import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('Worker health API', () => {
  it('returns a healthy response from the Worker entrypoint', async () => {
    const response = await exports.default.fetch(new Request('http://example.com/api/health'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
