import { describe, expect, it } from 'vitest'

import { resolveAuthReadiness } from '../../src/features/auth/auth-readiness'

describe('resolveAuthReadiness', () => {
  it('stays loading while Auth0 is resolving', () => {
    expect(
      resolveAuthReadiness({
        auth0IsAuthenticated: false,
        auth0IsLoading: true,
        backendIsAuthenticated: false,
        backendIsLoading: true,
      }),
    ).toEqual({ status: 'loading' })
  })

  it('treats a signed-out Auth0 session as unauthenticated', () => {
    expect(
      resolveAuthReadiness({
        auth0IsAuthenticated: false,
        auth0IsLoading: false,
        backendIsAuthenticated: false,
        backendIsLoading: false,
      }),
    ).toEqual({ status: 'unauthenticated' })
  })

  it('waits for the Worker API after Auth0 is authenticated', () => {
    expect(
      resolveAuthReadiness({
        auth0IsAuthenticated: true,
        auth0IsLoading: false,
        backendIsAuthenticated: false,
        backendIsLoading: true,
      }),
    ).toEqual({ status: 'loading' })
  })

  it('requires Auth0 and the Worker API before exposing protected UI', () => {
    expect(
      resolveAuthReadiness({
        auth0IsAuthenticated: true,
        auth0IsLoading: false,
        backendIsAuthenticated: true,
        backendIsLoading: false,
      }),
    ).toEqual({ status: 'authenticated' })
  })

  it('fails closed when the Worker API rejects the token', () => {
    expect(
      resolveAuthReadiness({
        auth0IsAuthenticated: true,
        auth0IsLoading: false,
        backendIsAuthenticated: false,
        backendIsLoading: false,
      }),
    ).toEqual({ reason: 'session_restore_failed', status: 'error' })
  })

  it('fails closed on an Auth0 restore error', () => {
    expect(
      resolveAuthReadiness({
        auth0Error: new Error('auth0_restore_failed'),
        auth0IsAuthenticated: false,
        auth0IsLoading: false,
        backendIsAuthenticated: false,
        backendIsLoading: false,
      }),
    ).toEqual({ reason: 'session_restore_failed', status: 'error' })
  })
})
