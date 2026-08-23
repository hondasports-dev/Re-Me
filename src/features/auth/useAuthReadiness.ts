import { resolveAuthReadiness, type AuthReadiness } from './auth-readiness'
import { useAuthSession } from './AuthSessionProvider'

export function useAuthReadiness(): AuthReadiness {
  const { status } = useAuthSession()

  return resolveAuthReadiness({
    authStatus: status,
    backendReady: null,
  })
}
