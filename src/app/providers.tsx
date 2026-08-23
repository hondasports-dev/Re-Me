import { Auth0Provider } from '@auth0/auth0-react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ConvexProviderWithAuth } from 'convex/react'
import { useState, type ReactNode } from 'react'
import { RouterProvider } from 'react-router'

import { AuthRuntimeProvider } from '../features/auth/AuthRuntimeProvider'
import { unconfiguredAuthRuntime, type AuthRuntime } from '../features/auth/auth-runtime'
import { LiveAuthRuntimeProvider } from '../features/auth/LiveAuthRuntimeProvider'
import { useConvexAuthFromAuth0 } from '../features/auth/useConvexAuthFromAuth0'
import { createAppRouter } from '../router'
import {
  createAuth0RedirectUri,
  readBrowserAuthConfig,
  type LiveBrowserAuthConfig,
} from '../shared/config/browser-env'
import { createConvexClient } from '../shared/convex/client'
import { reMeCssVariablesResolver, reMeTheme } from '../styles/theme'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

interface AppProvidersProps {
  children?: ReactNode
  runtime?: AuthRuntime
}

export function AppProviders({ children, runtime }: AppProvidersProps) {
  const [router] = useState(() => createAppRouter())
  const tree = children ?? <RouterProvider router={router} />

  return (
    <MantineProvider
      cssVariablesResolver={reMeCssVariablesResolver}
      defaultColorScheme="light"
      forceColorScheme="light"
      theme={reMeTheme}
    >
      <Notifications position="top-center" />
      <AuthTree runtime={runtime}>{tree}</AuthTree>
    </MantineProvider>
  )
}

function AuthTree({ children, runtime }: { children: ReactNode; runtime?: AuthRuntime }) {
  if (runtime) {
    return <AuthRuntimeProvider value={runtime}>{children}</AuthRuntimeProvider>
  }

  const config = readBrowserAuthConfig()

  if (config.kind === 'live') {
    return <LiveAuthProviders config={config}>{children}</LiveAuthProviders>
  }

  return <AuthRuntimeProvider value={unconfiguredAuthRuntime}>{children}</AuthRuntimeProvider>
}

function LiveAuthProviders({
  children,
  config,
}: {
  children: ReactNode
  config: LiveBrowserAuthConfig
}) {
  const [convexClient] = useState(() => createConvexClient(config.convexUrl))

  return (
    <Auth0Provider
      authorizationParams={{
        redirect_uri: createAuth0RedirectUri(window.location.origin),
        scope: 'openid profile email offline_access',
      }}
      cacheLocation="localstorage"
      clientId={config.auth0ClientId}
      domain={config.auth0Domain}
      useRefreshTokens
      useRefreshTokensFallback
    >
      <ConvexProviderWithAuth client={convexClient} useAuth={useConvexAuthFromAuth0}>
        <LiveAuthRuntimeProvider>{children}</LiveAuthRuntimeProvider>
      </ConvexProviderWithAuth>
    </Auth0Provider>
  )
}
