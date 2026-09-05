export type AuthReadiness =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated' }
  | { reason: 'session_restore_failed'; status: 'error' }

export interface AuthReadinessInput {
  auth0Error?: Error
  auth0IsAuthenticated: boolean
  auth0IsLoading: boolean
  backendIsAuthenticated?: boolean
  backendIsLoading?: boolean
  /** Compatibility fields for tests and the pre-migration runtime. */
  convexIsAuthenticated?: boolean
  convexIsLoading?: boolean
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

  const backendIsLoading = input.backendIsLoading ?? input.convexIsLoading ?? false
  const backendIsAuthenticated = input.backendIsAuthenticated ?? input.convexIsAuthenticated ?? true

  if (backendIsLoading) {
    return { status: 'loading' }
  }

  if (!backendIsAuthenticated) {
    return { reason: 'session_restore_failed', status: 'error' }
  }

  return { status: 'authenticated' }
}
