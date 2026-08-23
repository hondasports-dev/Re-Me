import type { AuthStatus } from './auth-session'

export type AuthReadinessKind =
  | 'auth-error'
  | 'auth-loading'
  | 'backend-loading'
  | 'ready'
  | 'unauthenticated'

export interface AuthReadiness {
  kind: AuthReadinessKind
}

export function resolveAuthReadiness(input: {
  authStatus: AuthStatus
  backendReady: boolean | null
}): AuthReadiness {
  if (input.authStatus === 'idle' || input.authStatus === 'initializing') {
    return { kind: 'auth-loading' }
  }

  if (input.authStatus === 'error') {
    return { kind: 'auth-error' }
  }

  if (input.authStatus !== 'authenticated') {
    return { kind: 'unauthenticated' }
  }

  if (input.backendReady === false) {
    return { kind: 'backend-loading' }
  }

  return { kind: 'ready' }
}
