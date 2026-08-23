import { describe, expect, it } from 'vitest'

import {
  AUTH0_DATABASE_CONNECTION,
  shouldStartE2eDatabaseLogin,
} from '../../src/features/auth/e2e-database-login'

describe('shouldStartE2eDatabaseLogin', () => {
  it('stays off in a normal production-like build', () => {
    expect(shouldStartE2eDatabaseLogin(undefined, new URLSearchParams('e2e_db=1'))).toBe(false)
  })

  it('stays off without the e2e query even when the preview flag is on', () => {
    expect(shouldStartE2eDatabaseLogin('1', new URLSearchParams())).toBe(false)
  })

  it('starts the Auth0 database connection only when both gates are set', () => {
    expect(shouldStartE2eDatabaseLogin('1', new URLSearchParams('e2e_db=1'))).toBe(true)
    expect(AUTH0_DATABASE_CONNECTION).toBe('Username-Password-Authentication')
  })
})
