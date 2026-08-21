import { MantineProvider } from '@mantine/core'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { AuthSessionProvider } from '../../src/features/auth/AuthSessionProvider'
import { AuthSessionManager } from '../../src/features/auth/auth-session'
import { createTestRouter } from '../../src/router'
import type { Database } from '../../src/shared/types/database.generated'
import { reMeTheme } from '../../src/styles/theme'

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

function manager(options: {
  initialSession?: Session | null
  exchangeSession?: Session | null
  exchangeError?: Error | null
}): AuthSessionManager {
  const auth = {
    exchangeCodeForSession: vi.fn().mockResolvedValue({
      data: { session: options.exchangeSession ?? session('exchanged') },
      error: options.exchangeError ?? null,
    }),
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: options.initialSession ?? null }, error: null }),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  }

  return new AuthSessionManager(() => ({ auth }) as unknown as SupabaseClient<Database>)
}

function renderAt(path: string, auth: AuthSessionManager, queryClient = new QueryClient()) {
  const router = createTestRouter([path])

  return {
    queryClient,
    router,
    ...render(
      <MantineProvider theme={reMeTheme}>
        <QueryClientProvider client={queryClient}>
          <AuthSessionProvider manager={auth}>
            <RouterProvider router={router} />
          </AuthSessionProvider>
        </QueryClientProvider>
      </MantineProvider>,
    ),
  }
}

describe('auth router guards', () => {
  it('waits for restore before redirecting an anonymous protected route', async () => {
    const { router } = renderAt('/', manager({ initialSession: null }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
  })

  it('keeps the callback public for an anonymous session', async () => {
    const { router, getByRole } = renderAt(
      '/auth/callback?error=access_denied&error_description=sensitive',
      manager({ initialSession: null }),
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/callback')
      expect(router.state.location.search).toBe('')
      expect(getByRole('heading', { name: 'ログインを完了できませんでした' })).toBeInTheDocument()
      expect(getByRole('button', { name: 'ログインへ戻る' })).toBeInTheDocument()
    })
  })

  it('exchanges a successful OAuth callback and replaces to the protected home route', async () => {
    const auth = manager({
      exchangeSession: session('exchanged-token'),
      initialSession: null,
    })
    const view = renderAt('/auth/callback?code=one-time-code', auth)

    await waitFor(() => {
      expect(view.router.state.location.pathname).toBe('/')
      expect(view.getByRole('heading', { name: '未来のあなたへ' })).toBeInTheDocument()
      expect(view.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    })
  })

  it('replaces the guest-only login route for an authenticated session', async () => {
    const view = renderAt('/login', manager({ initialSession: session() }))

    await waitFor(() => {
      expect(view.router.state.location.pathname).toBe('/')
      expect(view.getByRole('heading', { name: '未来のあなたへ' })).toBeInTheDocument()
    })
  })

  it('clears the authenticated shell after logout and returns to login', async () => {
    const auth = manager({ initialSession: session() })
    const queryClient = new QueryClient()
    queryClient.setQueryData(['letters'], [{ id: 'letter-1' }])
    auth.registerProtectedStateReset(() => {
      queryClient.clear()
    })

    const view = renderAt('/', auth, queryClient)
    const user = userEvent.setup()

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    })

    await user.click(view.getByRole('button', { name: 'ログアウト' }))

    await waitFor(() => {
      expect(view.router.state.location.pathname).toBe('/login')
      expect(view.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument()
      expect(view.getByRole('button', { name: 'Googleで続ける' })).toBeInTheDocument()
      expect(queryClient.getQueryData(['letters'])).toBeUndefined()
    })
  })
})
