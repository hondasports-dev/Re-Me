import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { AuthSessionManager } from '../../src/features/auth/auth-session'
import type { Database } from '../../src/shared/types/database.generated'

function session(accessToken = 'access-token'): Session {
  return {
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
  }
}

function authClient(initialSession: Session | null = null) {
  let callback: ((event: AuthChangeEvent, session: Session | null) => void) | undefined
  const unsubscribe = vi.fn()
  const auth = {
    exchangeCodeForSession: vi.fn().mockResolvedValue({
      data: { session: initialSession ?? session() },
      error: null,
    }),
    getSession: vi.fn().mockResolvedValue({ data: { session: initialSession }, error: null }),
    onAuthStateChange: vi.fn((nextCallback) => {
      callback = nextCallback
      return { data: { subscription: { unsubscribe } } }
    }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  }

  return {
    auth,
    client: { auth } as unknown as SupabaseClient<Database>,
    emit(event: AuthChangeEvent, nextSession: Session | null): void {
      callback?.(event, nextSession)
    },
    unsubscribe,
  }
}

describe('AuthSessionManager', () => {
  it('restores a session once for concurrent initialization and tracks auth events', async () => {
    const fake = authClient(session())
    const manager = new AuthSessionManager(() => fake.client)

    await Promise.all([manager.initialize(), manager.initialize()])

    expect(fake.auth.getSession).toHaveBeenCalledTimes(1)
    expect(fake.auth.onAuthStateChange).toHaveBeenCalledTimes(1)
    expect(manager.status.value).toBe('authenticated')

    fake.emit('TOKEN_REFRESHED', session('refreshed-token'))
    expect(manager.session.value?.access_token).toBe('refreshed-token')

    manager.destroy()
    expect(fake.unsubscribe).toHaveBeenCalledOnce()
  })

  it('fails closed when session restore fails', async () => {
    const fake = authClient()
    fake.auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('secret') })
    const manager = new AuthSessionManager(() => fake.client)

    await expect(manager.initialize()).rejects.toMatchObject({ code: 'session_restore_failed' })
    expect(manager.status.value).toBe('error')
    expect(manager.session.value).toBeNull()
  })

  it('can restore again after a transient initialization failure', async () => {
    const fake = authClient()
    fake.auth.getSession
      .mockResolvedValueOnce({ data: { session: null }, error: new Error('temporary') })
      .mockResolvedValueOnce({ data: { session: session() }, error: null })
    const manager = new AuthSessionManager(() => fake.client)

    await expect(manager.initialize()).rejects.toMatchObject({ code: 'session_restore_failed' })
    await expect(manager.initialize()).resolves.toBeUndefined()

    expect(fake.auth.getSession).toHaveBeenCalledTimes(2)
    expect(fake.auth.onAuthStateChange).toHaveBeenCalledTimes(1)
    expect(manager.status.value).toBe('authenticated')
  })

  it('starts Google PKCE with an exact trusted callback and exchanges a code once', async () => {
    const fake = authClient()
    const manager = new AuthSessionManager(() => fake.client)

    await manager.signInWithGoogle()
    expect(fake.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'http://localhost:3000/auth/callback' },
    })

    await manager.completeOAuthCallback('one-time-code')
    await expect(manager.completeOAuthCallback('one-time-code')).rejects.toMatchObject({
      code: 'oauth_code_already_used',
    })
  })

  it('clears protected state before local logout completes', async () => {
    const fake = authClient(session())
    const manager = new AuthSessionManager(() => fake.client)
    const reset = vi.fn()
    manager.registerProtectedStateReset(reset)
    await manager.initialize()

    await manager.signOut()

    expect(manager.session.value).toBeNull()
    expect(reset).toHaveBeenCalledOnce()
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('reads the current access token instead of keeping a token snapshot', async () => {
    const fake = authClient(session('old-token'))
    const manager = new AuthSessionManager(() => fake.client)
    await manager.initialize()
    fake.auth.getSession.mockResolvedValue({ data: { session: session('new-token') }, error: null })

    await expect(manager.getAccessToken()).resolves.toBe('new-token')
  })
})
