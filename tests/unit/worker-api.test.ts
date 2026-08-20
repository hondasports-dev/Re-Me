import type { Session } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { AuthSessionListener, AuthSessionReader } from '../../src/features/auth/auth-session'
import { createWorkerApiFetch } from '../../src/shared/api/worker'

function authReader(): AuthSessionReader & { emit(session: Session | null): void } {
  let listener: AuthSessionListener | undefined

  return {
    epoch: 1,
    emit(session): void {
      listener?.(session, session ? 'SIGNED_IN' : 'SIGNED_OUT')
    },
    getAccessToken: vi.fn().mockResolvedValue('current-access-token'),
    handleUnauthorized: vi.fn(),
    onSessionChange(nextListener): () => void {
      listener = nextListener
      return () => {
        listener = undefined
      }
    },
  }
}

describe('createWorkerApiFetch', () => {
  it('adds the current access token only to same-origin API paths', async () => {
    const auth = authReader()
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const apiFetch = createWorkerApiFetch(auth, fetchMock)

    await apiFetch('/api/letters', { method: 'POST', body: JSON.stringify({ value: 'safe' }) })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer current-access-token')
    expect(auth.getAccessToken).toHaveBeenCalledOnce()
    await expect(apiFetch('https://evil.example/api')).rejects.toMatchObject({
      code: 'worker_api_path_invalid',
    })
  })

  it.each(['/api/../outside', '/api/%2e%2e/outside', '/api/%2Foutside', '//evil.example/api'])(
    'rejects a path that can normalize outside the API boundary: %s',
    async (path) => {
      const auth = authReader()
      const fetchMock = vi.fn()
      const apiFetch = createWorkerApiFetch(auth, fetchMock)

      await expect(apiFetch(path)).rejects.toMatchObject({ code: 'worker_api_path_invalid' })
      expect(auth.getAccessToken).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('rejects caller-managed authorization and never retries a 401', async () => {
    const auth = authReader()
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    const apiFetch = createWorkerApiFetch(auth, fetchMock)

    await expect(
      apiFetch('/api/letters', { headers: { Authorization: 'Bearer caller-token' } }),
    ).rejects.toMatchObject({ code: 'authorization_header_managed' })

    const response = await apiFetch('/api/letters')
    expect(response.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(auth.handleUnauthorized).toHaveBeenCalledOnce()
  })
})
