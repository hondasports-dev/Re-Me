import { describe, expect, it } from 'vitest'

import {
  assertBrowserSafeViteEnv,
  createAuth0RedirectUri,
  readBrowserAuthConfig,
} from '../../src/shared/config/browser-env'

describe('readBrowserAuthConfig', () => {
  it('stays unconfigured when Auth0 and API env are absent', () => {
    expect(readBrowserAuthConfig({})).toEqual({ kind: 'unconfigured' })
  })

  it('reads a live Auth0 + Worker API configuration', () => {
    expect(
      readBrowserAuthConfig({
        VITE_AUTH0_CLIENT_ID: 'spa-client-id',
        VITE_AUTH0_DOMAIN: 're-me-dev.auth0.com',
        VITE_API_BASE_URL: 'https://re-me.example.com',
      }),
    ).toEqual({
      kind: 'live',
      auth0ClientId: 'spa-client-id',
      auth0Domain: 're-me-dev.auth0.com',
      apiBaseUrl: 'https://re-me.example.com',
    })
  })

  it('rejects a partial configuration instead of booting a half-wired provider tree', () => {
    expect(() =>
      readBrowserAuthConfig({
        VITE_AUTH0_DOMAIN: 're-me-dev.auth0.com',
      }),
    ).toThrowError('browser_auth_configuration_incomplete')
  })

  it.each([
    {
      VITE_AUTH0_CLIENT_ID: 'spa-client-id',
      VITE_AUTH0_DOMAIN: 'https://re-me-dev.auth0.com',
      VITE_API_BASE_URL: 'https://re-me.example.com',
    },
    {
      VITE_AUTH0_CLIENT_ID: 'spa-client-id',
      VITE_AUTH0_DOMAIN: 're-me-dev.auth0.com',
      VITE_API_BASE_URL: 'http://example.com',
    },
  ])('rejects a malformed live configuration without returning values', (env) => {
    expect(() => readBrowserAuthConfig(env)).toThrowError('browser_auth_configuration_invalid')
  })

  it('builds the Auth0 SPA callback URL from the app origin', () => {
    expect(createAuth0RedirectUri('http://127.0.0.1:5173')).toBe(
      'http://127.0.0.1:5173/auth/callback',
    )
  })
})

describe('assertBrowserSafeViteEnv', () => {
  it('rejects backend deploy keys and Auth0 secrets under VITE names', () => {
    expect(() =>
      assertBrowserSafeViteEnv({
        VITE_CONVEX_DEPLOY_KEY: 'cvx_prod_must_not_bundle',
      }),
    ).toThrowError('privileged_browser_credential_rejected')

    expect(() =>
      assertBrowserSafeViteEnv({
        VITE_AUTH0_CLIENT_SECRET: 'oauth-client-secret',
      }),
    ).toThrowError('privileged_browser_credential_rejected')

    expect(() =>
      assertBrowserSafeViteEnv({
        VITE_WEB_PUSH_VAPID_PRIVATE_KEY: 'vapid-private-must-not-bundle',
      }),
    ).toThrowError('privileged_browser_credential_rejected')
  })

  it('allows public SPA configuration', () => {
    expect(() =>
      assertBrowserSafeViteEnv({
        VITE_AUTH0_CLIENT_ID: 'spa-client-id',
        VITE_AUTH0_DOMAIN: 're-me-dev.auth0.com',
        VITE_API_BASE_URL: 'https://re-me.example.com',
        VITE_WEB_PUSH_VAPID_PUBLIC_KEY: 'vapid-public',
      }),
    ).not.toThrow()
  })
})
