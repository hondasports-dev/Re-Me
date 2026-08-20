import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createMemoryHistory } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { AuthSessionManager } from '../../src/features/auth/auth-session'
import { createAppRouter } from '../../src/router'
import type { Database } from '../../src/shared/types/database.generated'

function session(): Session {
  return {
    access_token: 'access-token',
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

function manager(initialSession: Session | null): AuthSessionManager {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: initialSession }, error: null }),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  }

  return new AuthSessionManager(() => ({ auth }) as unknown as SupabaseClient<Database>)
}

describe('auth router guards', () => {
  it('waits for restore before redirecting an anonymous protected route', async () => {
    const router = createAppRouter(createMemoryHistory(), manager(null))
    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('keeps the callback public for an anonymous session', async () => {
    const router = createAppRouter(createMemoryHistory(), manager(null))
    await router.push('/auth/callback?code=one-time-code')

    expect(router.currentRoute.value.name).toBe('auth-callback')
  })

  it('replaces the guest-only login route for an authenticated session', async () => {
    const router = createAppRouter(createMemoryHistory(), manager(session()))
    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('home')
  })
})
