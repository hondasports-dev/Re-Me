import { useAuth0 } from '@auth0/auth0-react'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useConvexAuthFromAuth0 } from '../../src/features/auth/useConvexAuthFromAuth0'

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: vi.fn(),
}))

describe('useConvexAuthFromAuth0', () => {
  it('keeps fetchAccessToken stable when Auth0 recreates getAccessTokenSilently', () => {
    const firstGetToken = vi.fn()
    const secondGetToken = vi.fn()
    vi.mocked(useAuth0).mockReturnValue({
      getAccessTokenSilently: firstGetToken,
      isAuthenticated: true,
      isLoading: false,
    } as never)

    const view = renderHook(() => useConvexAuthFromAuth0())
    const firstFetcher = view.result.current.fetchAccessToken

    vi.mocked(useAuth0).mockReturnValue({
      getAccessTokenSilently: secondGetToken,
      isAuthenticated: true,
      isLoading: false,
    } as never)
    view.rerender()

    expect(view.result.current.fetchAccessToken).toBe(firstFetcher)
  })

  it('reads a cached Auth0 ID token even when Convex asks to force refresh', async () => {
    const getAccessTokenSilently = vi.fn().mockResolvedValue({ id_token: 'cached.jwt' })
    vi.mocked(useAuth0).mockReturnValue({
      getAccessTokenSilently,
      isAuthenticated: true,
      isLoading: false,
    } as never)

    const view = renderHook(() => useConvexAuthFromAuth0())
    const token = await view.result.current.fetchAccessToken({ forceRefreshToken: true })

    expect(token).toBe('cached.jwt')
    expect(getAccessTokenSilently).toHaveBeenCalledWith({
      cacheMode: 'on',
      detailedResponse: true,
    })
  })
})
