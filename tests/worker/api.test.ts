import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

type Worker = typeof exports.default

const worker = exports.default as Worker

describe('Worker domain API', () => {
  it('provisions a user, keeps metadata private, and sends an immutable letter', async () => {
    const identity = `api-user-${crypto.randomUUID()}|api@example.com|API User`
    const ensured = await request('/api/users/ensure', { method: 'POST', body: '{}' }, identity)
    expect(ensured.status).toBe(200)
    expect(((await ensured.json()) as { email?: string }).email).toBe('api@example.com')

    const created = await request('/api/letters/drafts', { method: 'POST', body: '{}' }, identity)
    expect(created.status).toBe(201)
    const draft = (await created.json()) as { letterId: string; threadId: string }

    await expectJson(
      `/api/letters/${draft.letterId}/draft`,
      { method: 'PATCH', body: JSON.stringify({ body: '未来の自分へ' }) },
      identity,
    )
    await expectJson(
      `/api/letters/${draft.letterId}/settings`,
      { method: 'PATCH', body: JSON.stringify({ sealed: true, deliveryMode: 'few_days' }) },
      identity,
    )

    const sent = await request(`/api/letters/${draft.letterId}/send`, { method: 'POST' }, identity)
    expect(sent.status).toBe(200)
    const sentBody = (await sent.json()) as Record<string, unknown>
    expect(sentBody.status).toBe('traveling')
    expect(sentBody).not.toHaveProperty('scheduledAt')

    const internalMetadata = await request(`/api/letters/${draft.letterId}/metadata`, {}, identity)
    expect(internalMetadata.status).toBe(200)
    expect(await internalMetadata.json()).not.toHaveProperty('scheduledAt')

    const contentBeforeOpen = await request(`/api/letters/${draft.letterId}/content`, {}, identity)
    expect(await contentBeforeOpen.json()).toBeNull()

    const immutableAttempt = await request(
      `/api/letters/${draft.letterId}/draft`,
      { method: 'PATCH', body: JSON.stringify({ body: '改変' }) },
      identity,
    )
    expect(immutableAttempt.status).toBe(409)
  })

  it('denies unauthenticated and cross-user access', async () => {
    const unauthenticated = await request('/api/users/ensure', { method: 'POST', body: '{}' })
    expect(unauthenticated.status).toBe(401)

    const owner = `owner-${crypto.randomUUID()}`
    const other = `other-${crypto.randomUUID()}`
    const created = await request('/api/letters/drafts', { method: 'POST', body: '{}' }, owner)
    const draft = (await created.json()) as { letterId: string }
    const response = await request(`/api/letters/${draft.letterId}/draft`, {}, other)
    const responseBody = await response.text()
    expect(response.status).toBe(200)
    expect(responseBody).toBe('null')
  })

  it('delivers through the local test-only force path and opens sealed content', async () => {
    const identity = `delivery-${crypto.randomUUID()}`
    const created = await request('/api/letters/drafts', { method: 'POST', body: '{}' }, identity)
    const draft = (await created.json()) as { letterId: string }
    await expectJson(
      `/api/letters/${draft.letterId}/draft`,
      { method: 'PATCH', body: JSON.stringify({ body: '開封できるかな' }) },
      identity,
    )
    await expectJson(
      `/api/letters/${draft.letterId}/settings`,
      { method: 'PATCH', body: JSON.stringify({ sealed: true, deliveryMode: 'few_days' }) },
      identity,
    )
    await expectJson(`/api/letters/${draft.letterId}/send`, { method: 'POST' }, identity)
    const delivered = await request(
      `/api/letters/${draft.letterId}/force-deliver`,
      { method: 'POST' },
      identity,
    )
    expect(delivered.status).toBe(200)

    const beforeOpen = await request(`/api/letters/${draft.letterId}/content`, {}, identity)
    expect(await beforeOpen.json()).toBeNull()
    await expectJson(`/api/letters/${draft.letterId}/open`, { method: 'POST' }, identity)
    const afterOpen = await request(`/api/letters/${draft.letterId}/content`, {}, identity)
    expect(((await afterOpen.json()) as { body: string }).body).toBe('開封できるかな')
  })
})

async function request(path: string, init: RequestInit = {}, identity?: string): Promise<Response> {
  const headers = new Headers(init.headers)
  if (identity) headers.set('x-re-me-test-user', identity)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return await worker.fetch(new Request(`http://example.com${path}`, { ...init, headers }))
}

async function expectJson(path: string, init: RequestInit, identity: string): Promise<unknown> {
  const response = await request(path, init, identity)
  if (response.status >= 300) {
    throw new Error(`${response.status}:${await response.text()}`)
  }
  return await response.json()
}
