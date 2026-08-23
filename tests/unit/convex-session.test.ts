import { describe, expect, it } from 'vitest'

import { resolveConvexSessionState } from '../../src/features/auth/convex-session'

describe('resolveConvexSessionState', () => {
  it('stays idle until Convex is authenticated', () => {
    expect(
      resolveConvexSessionState({
        isAuthenticated: false,
        provisionError: null,
        user: { userId: 'users:1' },
      }),
    ).toBe('idle')
  })

  it('waits for the authenticated users query after login', () => {
    expect(
      resolveConvexSessionState({
        isAuthenticated: true,
        provisionError: null,
        user: null,
      }),
    ).toBe('loading')
  })

  it('is ready when the provisioned user is available', () => {
    expect(
      resolveConvexSessionState({
        isAuthenticated: true,
        provisionError: null,
        user: { userId: 'users:1' },
      }),
    ).toBe('ready')
  })

  it('fails closed when user provision fails', () => {
    expect(
      resolveConvexSessionState({
        isAuthenticated: true,
        provisionError: new Error('user_provision_failed'),
        user: null,
      }),
    ).toBe('error')
  })
})
