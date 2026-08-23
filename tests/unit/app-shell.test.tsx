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
import { reMeCssVariablesResolver, reMeTheme } from '../../src/styles/theme'

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

function manager(
  options: {
    hangRestore?: boolean
    initialSession?: Session | null
  } = {},
): AuthSessionManager {
  const auth = {
    getSession: options.hangRestore
      ? vi.fn(() => new Promise(() => {}))
      : vi
          .fn()
          .mockResolvedValue({ data: { session: options.initialSession ?? null }, error: null }),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  }

  return new AuthSessionManager(() => ({ auth }) as unknown as SupabaseClient<Database>)
}

function renderApp(auth: AuthSessionManager, initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createTestRouter(initialEntries)

  return render(
    <MantineProvider cssVariablesResolver={reMeCssVariablesResolver} theme={reMeTheme}>
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider manager={auth}>
          <RouterProvider router={router} />
        </AuthSessionProvider>
      </QueryClientProvider>
    </MantineProvider>,
  )
}

describe('AppShell', () => {
  it('redirects an anonymous visitor to the mobile-first login shell', async () => {
    const screen = renderApp(manager({ initialSession: null }), ['/'])

    await waitFor(() => {
      expect(screen.getByLabelText('Re:Me 未来のあなたへ')).toHaveTextContent('Re:Me')
      expect(screen.getByRole('heading', { name: '未来のあなたへ' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Googleで続ける' })).toBeInTheDocument()
      expect(
        screen.queryByRole('navigation', { name: 'メインナビゲーション' }),
      ).not.toBeInTheDocument()
    })
  })

  it('shows auth loading instead of content loading while restoring a session', () => {
    const screen = renderApp(manager({ hangRestore: true }), ['/'])

    expect(screen.getByRole('status')).toHaveAttribute('data-status', 'auth-loading')
    expect(screen.getByRole('heading', { name: '認証を確認しています' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '届いた手紙' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'メインナビゲーション' }),
    ).not.toBeInTheDocument()
  })

  it('renders the authenticated mobile shell with a keyboard-reachable bottom nav', async () => {
    const user = userEvent.setup()
    const screen = renderApp(manager({ initialSession: session() }), ['/'])

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'メインナビゲーション' })).toBeInTheDocument()
    })

    const inbox = screen.getByRole('link', { name: '届いた手紙' })
    const write = screen.getByRole('link', { name: '書く' })
    const traveling = screen.getByRole('link', { name: '旅する手紙' })

    expect(inbox).toHaveAttribute('aria-current', 'page')
    expect(write).not.toHaveAttribute('aria-current')
    expect(traveling).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('heading', { name: '届いた手紙' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '届いた手紙' }).closest('[data-status]'),
    ).toHaveAttribute('data-status', 'content-empty')
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()

    inbox.focus()
    expect(inbox).toHaveFocus()
    await user.tab()
    expect(write).toHaveFocus()
    await user.tab()
    expect(traveling).toHaveFocus()

    await user.click(write)
    expect(write).toHaveAttribute('aria-current', 'page')
    expect(inbox).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('heading', { name: '手紙を書く' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '手紙を書く' }).closest('[data-status]'),
    ).toHaveAttribute('data-status', 'content-empty')
  })
})
