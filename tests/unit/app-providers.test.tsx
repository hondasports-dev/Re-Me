import { render, waitFor } from '@testing-library/react'
import { RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AppProviders } from '../../src/app/providers'
import { createTestRouter } from '../../src/router'

describe('AppProviders', () => {
  it('boots the router without Auth0 when browser auth env is absent', async () => {
    const router = createTestRouter(['/'])
    const screen = render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
      expect(screen.getByRole('button', { name: 'Googleで続ける' })).toBeInTheDocument()
    })
  })
})
