import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { AppProviders } from '../../src/app/providers'
import { createTestAuthRuntime } from '../../src/features/auth/auth-runtime'
import { createTestRouter } from '../../src/router'

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(() => new Promise(() => undefined)),
  useQuery: () => undefined,
}))

function renderApp(
  status: 'unauthenticated' | 'loading' | 'authenticated',
  initialEntries: string[] = ['/'],
) {
  const router = createTestRouter(initialEntries)

  return render(
    <AppProviders runtime={createTestAuthRuntime({ status })}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

describe('AppShell', () => {
  it('redirects an anonymous visitor to the mobile-first login shell', async () => {
    const screen = renderApp('unauthenticated', ['/'])

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
    const screen = renderApp('loading', ['/'])

    expect(screen.getByRole('status')).toHaveAttribute('data-status', 'auth-loading')
    expect(screen.getByRole('heading', { name: '認証を確認しています' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '届いた手紙' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'メインナビゲーション' }),
    ).not.toBeInTheDocument()
  })

  it('renders the authenticated mobile shell with a keyboard-reachable bottom nav', async () => {
    const user = userEvent.setup()
    const screen = renderApp('authenticated', ['/'])

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
    ).toHaveAttribute('data-status', 'content-loading')
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '設定' })).toHaveAttribute('href', '/settings')

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
    ).toHaveAttribute('data-status', 'content-loading')
  })
})
