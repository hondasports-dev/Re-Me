import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthSessionManager } from '../../src/features/auth/auth-session'
import type { Database } from '../../src/shared/types/database.generated'

const authUrl = 'https://project-ref.supabase.co'
const storageKey = 'sb-project-ref-auth-token'

function createMemoryStorage(): SupportedStorage {
  const values = new Map<string, string>()

  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  })
}

describe('Supabase Auth SDK integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists a Google PKCE verifier, exchanges the code, restores the session, and logs out locally', async () => {
    const storage = createMemoryStorage()
    const accessToken = jwt({
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: 'authenticated',
      session_id: 'session-id',
      sub: 'user-id',
    })
    let exchangedVerifier: string | undefined
    let logoutScope: string | null = null

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(typeof input === 'string' ? input : input.toString())

      if (requestUrl.pathname === '/auth/v1/token') {
        const body = JSON.parse(String(init?.body)) as {
          auth_code: string
          code_verifier: string
        }
        expect(requestUrl.searchParams.get('grant_type')).toBe('pkce')
        expect(body.auth_code).toBe('one-time-code')
        exchangedVerifier = body.code_verifier

        return jsonResponse({
          access_token: accessToken,
          expires_in: 3600,
          refresh_token: 'refresh-token',
          token_type: 'bearer',
          user: {
            app_metadata: {},
            aud: 'authenticated',
            created_at: '2026-08-20T00:00:00.000Z',
            id: 'user-id',
            user_metadata: {},
          },
        })
      }

      if (requestUrl.pathname === '/auth/v1/logout') {
        logoutScope = requestUrl.searchParams.get('scope')
        return jsonResponse({})
      }

      throw new Error(`Unexpected Auth request: ${requestUrl.pathname}`)
    })

    const createAuthClient = () =>
      createClient<Database>(authUrl, 'sb_publishable_test', {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: 'pkce',
          persistSession: true,
          storage,
          storageKey,
        },
        global: { fetch: fetchMock },
      })

    const firstClient = createAuthClient()
    const { data: oauth, error: oauthError } = await firstClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback',
        skipBrowserRedirect: true,
      },
    })

    expect(oauthError).toBeNull()
    expect(oauth.url).toContain('/auth/v1/authorize?provider=google')
    expect(oauth.url).toContain('code_challenge=')
    expect(oauth.url).toContain(
      `redirect_to=${encodeURIComponent('http://localhost:3000/auth/callback')}`,
    )

    const firstManager = new AuthSessionManager(() => firstClient)
    await firstManager.completeOAuthCallback('one-time-code')
    expect(exchangedVerifier).toMatch(/^.{43,128}$/)
    expect(firstManager.status).toBe('authenticated')
    firstManager.destroy()

    const restoredClient = createAuthClient()
    const restoredManager = new AuthSessionManager(() => restoredClient)
    await restoredManager.initialize()
    expect(restoredManager.session?.user.id).toBe('user-id')

    await restoredManager.signOut()
    expect(logoutScope).toBe('local')
    expect(restoredManager.session).toBeNull()
    await expect(restoredClient.auth.getSession()).resolves.toMatchObject({
      data: { session: null },
      error: null,
    })
    restoredManager.destroy()
  })
})
