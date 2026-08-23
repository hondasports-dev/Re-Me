import type { AuthReadiness } from './auth-readiness'

export interface AuthLoginOptions {
  connection?: string
}

export interface AuthRuntime {
  loginWithRedirect: (options?: AuthLoginOptions) => Promise<void>
  logout: () => Promise<void>
  readiness: AuthReadiness
}

export const unconfiguredAuthRuntime: AuthRuntime = {
  readiness: { status: 'unauthenticated' },
  async loginWithRedirect(): Promise<void> {
    throw new Error('auth_providers_unconfigured')
  },
  async logout(): Promise<void> {
    return
  },
}

export function createTestAuthRuntime(
  readiness: AuthReadiness,
  actions: Partial<Pick<AuthRuntime, 'loginWithRedirect' | 'logout'>> = {},
): AuthRuntime {
  return {
    loginWithRedirect: actions.loginWithRedirect ?? (async () => undefined),
    logout: actions.logout ?? (async () => undefined),
    readiness,
  }
}
