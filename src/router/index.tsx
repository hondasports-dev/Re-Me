import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router'

import { App } from '../app/App'
import { AuthCallbackPage } from '../features/auth/pages/AuthCallbackPage'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ComposePage } from '../features/compose/pages/ComposePage'
import { InboxPage } from '../features/inbox/pages/InboxPage'
import { TravelingPage } from '../features/traveling/pages/TravelingPage'
import { GuestOnly, RequireAuth } from './RequireAuth'

export type AppRouter = ReturnType<typeof createBrowserRouter>

export function createAppRoutes(): RouteObject[] {
  return [
    {
      path: '/',
      element: <App />,
      children: [
        {
          element: <RequireAuth />,
          children: [
            {
              index: true,
              element: <InboxPage />,
            },
            {
              path: 'write',
              element: <ComposePage />,
            },
            {
              path: 'traveling',
              element: <TravelingPage />,
            },
          ],
        },
        {
          element: <GuestOnly />,
          children: [
            {
              path: 'login',
              element: <LoginPage />,
            },
          ],
        },
        {
          path: 'auth/callback',
          element: <AuthCallbackPage />,
        },
      ],
    },
  ]
}

export function createAppRouter(): AppRouter {
  return createBrowserRouter(createAppRoutes())
}

export function createTestRouter(initialEntries: string[] = ['/']): AppRouter {
  return createMemoryRouter(createAppRoutes(), { initialEntries })
}
