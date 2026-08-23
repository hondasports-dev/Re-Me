import { useAuth0 } from '@auth0/auth0-react'
import { useConvexAuth } from 'convex/react'
import { useMemo, type ReactNode } from 'react'

import { resolveAuthReadiness } from './auth-readiness'
import type { AuthLoginOptions } from './auth-runtime'
import { AuthRuntimeProvider } from './AuthRuntimeProvider'

export function LiveAuthRuntimeProvider({ children }: { children: ReactNode }) {
  const auth0 = useAuth0()
  const convexAuth = useConvexAuth()

  const runtime = useMemo(
    () => ({
      readiness: resolveAuthReadiness({
        auth0Error: auth0.error,
        auth0IsAuthenticated: auth0.isAuthenticated,
        auth0IsLoading: auth0.isLoading,
        convexIsAuthenticated: convexAuth.isAuthenticated,
        convexIsLoading: convexAuth.isLoading,
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
    [auth0, convexAuth],
  )

  return <AuthRuntimeProvider value={runtime}>{children}</AuthRuntimeProvider>
}
