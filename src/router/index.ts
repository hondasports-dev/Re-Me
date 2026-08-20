import { createRouter, createWebHistory, type Router, type RouterHistory } from 'vue-router'

import { authSession, type AuthSessionManager } from '../features/auth/auth-session'
import AuthCallbackView from '../features/auth/views/AuthCallbackView.vue'
import LoginView from '../features/auth/views/LoginView.vue'
import HomeView from '../features/home/views/HomeView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    guestOnly?: boolean
    requiresAuth?: boolean
  }
}

export function createAppRouter(
  history: RouterHistory = createWebHistory(),
  auth: AuthSessionManager = authSession,
): Router {
  const router = createRouter({
    history,
    routes: [
      {
        path: '/',
        name: 'home',
        component: HomeView,
        meta: { requiresAuth: true },
      },
      {
        path: '/login',
        name: 'login',
        component: LoginView,
        meta: { guestOnly: true },
      },
      {
        path: '/auth/callback',
        name: 'auth-callback',
        component: AuthCallbackView,
      },
    ],
  })

  router.beforeEach(async (to) => {
    try {
      await auth.initialize()
    } catch {
      if (to.name === 'login' || to.name === 'auth-callback') {
        return true
      }

      return { name: 'login', query: { reason: 'session_restore_failed' }, replace: true }
    }

    if (to.meta.requiresAuth && !auth.session.value) {
      return { name: 'login', replace: true }
    }

    if (to.meta.guestOnly && auth.session.value) {
      return { name: 'home', replace: true }
    }

    return true
  })

  auth.onSessionChange((session) => {
    queueMicrotask(() => {
      const currentRoute = router.currentRoute.value

      if (!session && currentRoute.meta.requiresAuth) {
        void router.replace({ name: 'login' })
      } else if (session && currentRoute.name === 'login') {
        void router.replace({ name: 'home' })
      }
    })
  })

  return router
}

const router = createAppRouter()

export default router
