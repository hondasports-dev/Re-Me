import { describe, expect, it } from 'vitest'

import { createAuthConfig } from '../../convex/auth.config'

describe('createAuthConfig', () => {
  it('fails closed when Auth0 env is missing', () => {
    expect(createAuthConfig({})).toEqual({ providers: [] })
    expect(createAuthConfig({ AUTH0_CLIENT_ID: 'spa', AUTH0_DOMAIN: '  ' })).toEqual({
      providers: [],
    })
  })

  it('uses the Auth0 SPA client id as the Convex audience and the tenant as issuer', () => {
    expect(
      createAuthConfig({
        AUTH0_CLIENT_ID: 're-me-dev-spa',
        AUTH0_DOMAIN: 're-me-dev.auth0.com',
      }),
    ).toEqual({
      providers: [
        {
          applicationID: 're-me-dev-spa',
          domain: 're-me-dev.auth0.com',
        },
      ],
    })
  })

  it('pins issuer and audience to the configured Auth0 tenant and SPA client', () => {
    const configured = createAuthConfig({
      AUTH0_CLIENT_ID: 're-me-dev-spa',
      AUTH0_DOMAIN: 're-me-dev.auth0.com',
    })
    const otherTenant = createAuthConfig({
      AUTH0_CLIENT_ID: 'other-spa',
      AUTH0_DOMAIN: 'other.auth0.com',
    })

    expect(configured.providers[0]).toEqual({
      applicationID: 're-me-dev-spa',
      domain: 're-me-dev.auth0.com',
    })
    expect(configured.providers).not.toEqual(otherTenant.providers)
  })
})
