import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuthSession } from '../features/auth/AuthSessionProvider'

export function RequireAuth() {
  const { session, status } = useAuthSession()
  const location = useLocation()

  if (status === 'idle' || status === 'initializing') {
    return null
  }

  if (status === 'error') {
    return <Navigate replace to="/login?reason=session_restore_failed" />
  }

  if (!session) {
    return <Navigate replace to="/login" state={{ from: location }} />
  }

  return <Outlet />
}

export function GuestOnly() {
  const { session, status } = useAuthSession()

  if (status === 'idle' || status === 'initializing') {
    return null
  }

  if (session) {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}
