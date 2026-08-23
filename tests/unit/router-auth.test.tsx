import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AppProviders } from '../../src/app/providers'
import { createTestAuthRuntime, type AuthRuntime } from '../../src/features/auth/auth-runtime'
import { createTestRouter } from '../../src/router'

function renderAt(path: string, runtime: AuthRuntime) {
  const router = createTestRouter([path])

  return {
    router,
    ...render(
      <AppProviders runtime={runtime}>
        <RouterProvider router={router} />
      </AppProviders>,
    ),
  }
}

describe('auth router guards', () => {
  it('waits for restore before redirecting an anonymous protected route', async () => {
    const { router } = renderAt('/', createTestAuthRuntime({ status: 'unauthenticated' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
  })

  it('keeps the callback public for an anonymous session', async () => {
    const { router, getByRole } = renderAt(
      '/auth/callback?error=access_denied&error_description=sensitive',
      createTestAuthRuntime({ status: 'unauthenticated' }),
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/callback')
      expect(router.state.location.search).toBe('')
      expect(getByRole('heading', { name: 'ログインを完了できませんでした' })).toBeInTheDocument()
      expect(getByRole('button', { name: 'ログインへ戻る' })).toBeInTheDocument()
    })
  })

  it('replaces to the protected home route once Auth0 and Convex are authenticated', async () => {
    const view = renderAt(
      '/auth/callback?code=one-time-code',
      createTestAuthRuntime({ status: 'authenticated' }),
    )

    await waitFor(() => {
      expect(view.router.state.location.pathname).toBe('/')
      expect(view.getByRole('heading', { name: '届いた手紙' })).toBeInTheDocument()
      expect(view.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
      expect(view.getByRole('navigation', { name: 'メインナビゲーション' })).toBeInTheDocument()
    })
  })

  it('replaces the guest-only login route for an authenticated session', async () => {
    const view = renderAt('/login', createTestAuthRuntime({ status: 'authenticated' }))

    await waitFor(() => {
      expect(view.router.state.location.pathname).toBe('/')
      expect(view.getByRole('heading', { name: '届いた手紙' })).toBeInTheDocument()
    })
  })

  it('clears the authenticated shell after logout and returns to login', async () => {
    function LogoutHarness() {
      const [runtime, setRuntime] = useState<AuthRuntime>(() =>
        createTestAuthRuntime(
          { status: 'authenticated' },
          {
            logout: async () => {
              setRuntime(createTestAuthRuntime({ status: 'unauthenticated' }))
            },
          },
        ),
      )
      const [router] = useState(() => createTestRouter(['/']))

      return (
        <AppProviders runtime={runtime}>
          <RouterProvider router={router} />
        </AppProviders>
      )
    }

    const view = render(<LogoutHarness />)
    const user = userEvent.setup()

    await waitFor(() => {
      expect(view.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    })

    await user.click(view.getByRole('button', { name: 'ログアウト' }))

    await waitFor(() => {
      expect(view.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument()
      expect(view.getByRole('button', { name: 'Googleで続ける' })).toBeInTheDocument()
    })
  })

  it('does not treat router state as enough to show protected data while Convex is still loading', async () => {
    const { router, getByRole, queryByRole } = renderAt(
      '/',
      createTestAuthRuntime({ status: 'loading' }),
    )

    expect(router.state.location.pathname).toBe('/')
    expect(getByRole('heading', { name: '認証を確認しています' })).toBeInTheDocument()
    expect(queryByRole('heading', { name: '届いた手紙' })).not.toBeInTheDocument()
    expect(queryByRole('navigation', { name: 'メインナビゲーション' })).not.toBeInTheDocument()
  })
})
