import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuthSession } from '../features/auth/AuthSessionProvider'
import { useAuthReadiness } from '../features/auth/useAuthReadiness'
import { StatusScreen } from '../shared/components/StatusScreen'

export function RequireAuth() {
  const { session } = useAuthSession()
  const readiness = useAuthReadiness()
  const location = useLocation()

  if (readiness.kind === 'auth-loading') {
    return (
      <StatusScreen
        description="未来へ続く場所を、静かに準備しています。"
        title="認証を確認しています"
        tone="auth"
        variant="loading"
      />
    )
  }

  if (readiness.kind === 'backend-loading') {
    return (
      <StatusScreen
        description="手紙を届ける準備をしています。"
        title="接続を確認しています"
        tone="backend"
        variant="loading"
      />
    )
  }

  if (readiness.kind === 'auth-error') {
    return <Navigate replace to="/login?reason=session_restore_failed" />
  }

  if (!session || readiness.kind === 'unauthenticated') {
    return <Navigate replace to="/login" state={{ from: location }} />
  }

  return <Outlet />
}

export function GuestOnly() {
  const { session } = useAuthSession()
  const readiness = useAuthReadiness()

  if (readiness.kind === 'auth-loading') {
    return (
      <StatusScreen
        description="未来へ続く場所を、静かに準備しています。"
        title="認証を確認しています"
        tone="auth"
        variant="loading"
      />
    )
  }

  if (session) {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}
