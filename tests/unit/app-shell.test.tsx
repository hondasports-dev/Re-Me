import { MantineProvider } from '@mantine/core'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { AuthSessionProvider } from '../../src/features/auth/AuthSessionProvider'
import { AuthSessionManager } from '../../src/features/auth/auth-session'
import { createTestRouter } from '../../src/router'
import type { Database } from '../../src/shared/types/database.generated'
import { reMeTheme } from '../../src/styles/theme'

function manager(initialSession: Session | null): AuthSessionManager {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: initialSession }, error: null }),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  }

  return new AuthSessionManager(() => ({ auth }) as unknown as SupabaseClient<Database>)
}

function renderApp(auth: AuthSessionManager, initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createTestRouter(initialEntries)

  return render(
    <MantineProvider theme={reMeTheme}>
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
    const screen = renderApp(manager(null), ['/'])

    await waitFor(() => {
      expect(screen.getByLabelText('Re:Me 未来のあなたへ')).toHaveTextContent('Re:Me')
      expect(screen.getByRole('heading', { name: '未来のあなたへ' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Googleで続ける' })).toBeInTheDocument()
    })
  })
})
