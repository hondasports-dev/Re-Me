import { describe, expect, it } from 'vitest'

import { handleWorkerFetch } from '../../worker/app'

describe('health API', () => {
  it('returns a healthy response', async () => {
    const response = handleWorkerFetch(new Request('http://localhost/api/health'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('accepts a trailing slash on the health path', async () => {
    const response = handleWorkerFetch(new Request('http://localhost/api/health/'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('does not expose a Hono application API surface', () => {
    const response = handleWorkerFetch(new Request('http://localhost/api/letters'))

    expect(response.status).toBe(404)
  })
})
