import { describe, expect, it } from 'vitest'

import { resolveAuthReadiness } from '../../src/features/auth/auth-readiness'

describe('resolveAuthReadiness', () => {
  it('keeps session restore distinct from backend readiness', () => {
    expect(resolveAuthReadiness({ authStatus: 'idle', backendReady: null })).toEqual({
      kind: 'auth-loading',
    })
    expect(resolveAuthReadiness({ authStatus: 'initializing', backendReady: false })).toEqual({
      kind: 'auth-loading',
    })
    expect(resolveAuthReadiness({ authStatus: 'error', backendReady: null })).toEqual({
      kind: 'auth-error',
    })
    expect(resolveAuthReadiness({ authStatus: 'anonymous', backendReady: null })).toEqual({
      kind: 'unauthenticated',
    })
  })

  it('exposes backend loading only after authentication succeeds', () => {
    expect(resolveAuthReadiness({ authStatus: 'authenticated', backendReady: false })).toEqual({
      kind: 'backend-loading',
    })
    expect(resolveAuthReadiness({ authStatus: 'authenticated', backendReady: true })).toEqual({
      kind: 'ready',
    })
    expect(resolveAuthReadiness({ authStatus: 'authenticated', backendReady: null })).toEqual({
      kind: 'ready',
    })
  })
})
