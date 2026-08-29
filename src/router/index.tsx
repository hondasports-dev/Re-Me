import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router'

import { App } from '../app/App'
import { AuthCallbackPage } from '../features/auth/pages/AuthCallbackPage'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ComposeEditorPage } from '../features/compose/pages/ComposeEditorPage'
import { ComposePage } from '../features/compose/pages/ComposePage'
import { ComposeSendPage } from '../features/compose/pages/ComposeSendPage'
import { InboxLetterPage } from '../features/inbox/pages/InboxLetterPage'
import { InboxPage } from '../features/inbox/pages/InboxPage'
import { ReplyPage } from '../features/compose/pages/ReplyPage'
import { ReplySendPage } from '../features/compose/pages/ReplySendPage'
import { ThreadPage } from '../features/thread/pages/ThreadPage'
import { TravelingLetterPage } from '../features/traveling/pages/TravelingLetterPage'
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
              path: 'letters/:letterId',
              element: <InboxLetterPage />,
            },
            {
              path: 'letters/:letterId/reply',
              element: <ReplyPage />,
            },
            {
              path: 'letters/:letterId/reply/send',
              element: <ReplySendPage />,
            },
            {
              path: 'threads/:threadId',
              element: <ThreadPage />,
            },
            {
              path: 'write',
              element: <ComposePage />,
            },
            {
              path: 'write/:letterId',
              element: <ComposeEditorPage />,
            },
            {
              path: 'write/:letterId/send',
              element: <ComposeSendPage />,
            },
            {
              path: 'traveling',
              element: <TravelingPage />,
            },
            {
              path: 'traveling/:letterId',
              element: <TravelingLetterPage />,
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
