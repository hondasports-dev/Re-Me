import { useAuth0 } from '@auth0/auth0-react'
import { useCallback, useMemo, type ReactNode } from 'react'

import { ApiClientProvider } from '../../shared/api/client'
import { readAuth0IdToken } from '../../shared/api/auth-token'
import { resolveAuthReadiness } from './auth-readiness'
import type { AuthLoginOptions } from './auth-runtime'
import { AuthRuntimeProvider } from './AuthRuntimeProvider'
import { CurrentUserSession } from './CurrentUserSession'

export function LiveAuthRuntimeProvider({
  children,
  apiBaseUrl,
}: {
  children: ReactNode
  apiBaseUrl: string
}) {
  const auth0 = useAuth0()
  const getToken = useCallback(
    () => readAuth0IdToken(auth0.getAccessTokenSilently),
    [auth0.getAccessTokenSilently],
  )

  const runtime = useMemo(
    () => ({
      readiness: resolveAuthReadiness({
        auth0Error: auth0.error,
        auth0IsAuthenticated: auth0.isAuthenticated,
        auth0IsLoading: auth0.isLoading,
        backendIsAuthenticated: auth0.isAuthenticated,
        backendIsLoading: false,
      }),
      async loginWithRedirect(options?: AuthLoginOptions): Promise<void> {
        await auth0.loginWithRedirect({
          authorizationParams: {
            connection: options?.connection ?? 'google-oauth2',
          },
        })
      },
      async logout(): Promise<void> {
        await auth0.logout({
          logoutParams: {
            returnTo: window.location.origin,
          },
        })
      },
    }),
    [auth0],
  )

  return (
    <ApiClientProvider options={{ baseUrl: apiBaseUrl, getToken }}>
      <AuthRuntimeProvider value={runtime}>
        <CurrentUserSession />
        {children}
      </AuthRuntimeProvider>
    </ApiClientProvider>
  )
}
