import { useAuth0 } from '@auth0/auth0-react'
import { useCallback, useMemo, useRef } from 'react'

export function useConvexAuthFromAuth0(): {
  fetchAccessToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>
  isAuthenticated: boolean
  isLoading: boolean
} {
  const { getAccessTokenSilently, isAuthenticated, isLoading } = useAuth0()
  const getTokenRef = useRef(getAccessTokenSilently)
  getTokenRef.current = getAccessTokenSilently

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken: _forceRefreshToken }: { forceRefreshToken: boolean }) => {
      // Convex asks for a forced refresh on reconnect. Auth0 cacheMode `off` talks to
      // the authorization server and can clear a still-valid SPA session when the
      // refresh token was rotated or revoked in another tab. Serve the cached ID token
      // instead; Auth0 still refreshes on its own when the cache is expired.
      return await readIdToken(getTokenRef.current)
    },
    [],
  )

  return useMemo(
    () => ({
      fetchAccessToken,
      isAuthenticated,
      isLoading,
    }),
    [fetchAccessToken, isAuthenticated, isLoading],
  )
}

async function readIdToken(
  getAccessTokenSilently: ReturnType<typeof useAuth0>['getAccessTokenSilently'],
): Promise<string | null> {
  try {
    const response = await getAccessTokenSilently({
      cacheMode: 'on',
      detailedResponse: true,
    })

    return response.id_token || null
  } catch {
    return null
  }
}
