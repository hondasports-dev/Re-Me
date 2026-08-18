import { describe, expect, it } from 'vitest'

import { app } from '../../worker/app'

describe('health API', () => {
  it('returns a healthy response', async () => {
    const response = await app.request('http://localhost/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
