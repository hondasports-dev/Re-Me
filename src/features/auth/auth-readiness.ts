export type AuthReadiness =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated' }
  | { reason: 'session_restore_failed'; status: 'error' }

export interface AuthReadinessInput {
  auth0Error?: Error
  auth0IsAuthenticated: boolean
  auth0IsLoading: boolean
  convexIsAuthenticated: boolean
  convexIsLoading: boolean
}

export function resolveAuthReadiness(input: AuthReadinessInput): AuthReadiness {
  if (input.auth0Error) {
    return { reason: 'session_restore_failed', status: 'error' }
  }

  if (input.auth0IsLoading) {
    return { status: 'loading' }
  }

  if (!input.auth0IsAuthenticated) {
    return { status: 'unauthenticated' }
  }

  if (input.convexIsLoading) {
    return { status: 'loading' }
  }

  if (!input.convexIsAuthenticated) {
    return { reason: 'session_restore_failed', status: 'error' }
  }

  return { status: 'authenticated' }
}
