import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { RouterProvider } from 'react-router'

import { AuthSessionProvider } from '../features/auth/AuthSessionProvider'
import { authSession } from '../features/auth/auth-session'
import { createAppRouter } from '../router'
import { createQueryClient } from '../shared/query/client'
import { reMeCssVariablesResolver, reMeTheme } from '../styles/theme'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

interface AppProvidersProps {
  children?: ReactNode
}

function AuthQueryBridge({ queryClient }: { queryClient: QueryClient }) {
  useEffect(() => {
    return authSession.registerProtectedStateReset(() => {
      queryClient.clear()
    })
  }, [queryClient])

  return null
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => createQueryClient())
  const [router] = useState(() => createAppRouter())

  return (
    <MantineProvider
      cssVariablesResolver={reMeCssVariablesResolver}
      defaultColorScheme="light"
      forceColorScheme="light"
      theme={reMeTheme}
    >
      <Notifications position="top-center" />
      <QueryClientProvider client={queryClient}>
        <AuthQueryBridge queryClient={queryClient} />
        <AuthSessionProvider>{children ?? <RouterProvider router={router} />}</AuthSessionProvider>
      </QueryClientProvider>
    </MantineProvider>
  )
}
