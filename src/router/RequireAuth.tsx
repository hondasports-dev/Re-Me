import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuthRuntime } from '../features/auth/AuthRuntimeProvider'
import { StatusScreen } from '../shared/components/StatusScreen'

export function RequireAuth() {
  const { readiness } = useAuthRuntime()
  const location = useLocation()

  if (readiness.status === 'loading') {
    return (
      <StatusScreen
        description="未来へ続く場所を、静かに準備しています。"
        title="認証を確認しています"
        tone="auth"
        variant="loading"
      />
    )
  }

  if (readiness.status === 'error') {
    return <Navigate replace to="/login?reason=session_restore_failed" />
  }

  if (readiness.status === 'unauthenticated') {
    return <Navigate replace to="/login" state={{ from: location }} />
  }

  return <Outlet />
}

export function GuestOnly() {
  const { readiness } = useAuthRuntime()

  if (readiness.status === 'loading') {
    return (
      <StatusScreen
        description="未来へ続く場所を、静かに準備しています。"
        title="認証を確認しています"
        tone="auth"
        variant="loading"
      />
    )
  }

  if (readiness.status === 'authenticated') {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}
