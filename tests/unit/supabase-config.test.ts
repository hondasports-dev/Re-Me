import { describe, expect, it } from 'vitest'

import { readBrowserSupabaseConfig } from '../../src/shared/api/supabase'
import {
  assertBrowserSafeSupabaseKey,
  assertBrowserSafeViteEnv,
} from '../../src/shared/config/supabase-key'

describe('readBrowserSupabaseConfig', () => {
  it('accepts HTTPS and local HTTP configuration', () => {
    expect(
      readBrowserSupabaseConfig({
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
        VITE_SUPABASE_URL: 'https://project.supabase.co/path',
      }),
    ).toEqual({
      publishableKey: 'sb_publishable_example',
      url: 'https://project.supabase.co',
    })

    expect(
      readBrowserSupabaseConfig({
        VITE_SUPABASE_PUBLISHABLE_KEY: 'local-key',
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      }).url,
    ).toBe('http://127.0.0.1:54321')
  })

  it.each([
    {},
    { VITE_SUPABASE_PUBLISHABLE_KEY: 'key', VITE_SUPABASE_URL: 'not-a-url' },
    { VITE_SUPABASE_PUBLISHABLE_KEY: 'key', VITE_SUPABASE_URL: 'http://example.com' },
    {
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_must_not_be_in_browser',
      VITE_SUPABASE_URL: 'https://project.supabase.co',
    },
  ])('fails closed without exposing configuration values', (env) => {
    expect(() => readBrowserSupabaseConfig(env)).toThrowError(
      /supabase_configuration|privileged_browser_credential/,
    )
  })

  it('rejects new and legacy privileged credentials without returning their values', () => {
    const serviceRolePayload = btoa(JSON.stringify({ role: 'service_role' }))
    const legacyServiceRoleKey = `header.${serviceRolePayload}.signature`

    for (const key of ['sb_secret_example', legacyServiceRoleKey]) {
      expect(() => assertBrowserSafeSupabaseKey(key)).toThrowError(
        'privileged_browser_credential_rejected',
      )
    }

    expect(() => assertBrowserSafeSupabaseKey('sb_publishable_example')).not.toThrow()
  })

  it('checks privileged values under every browser-visible VITE name', () => {
    expect(() =>
      assertBrowserSafeViteEnv({
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
        VITE_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_misconfigured',
      }),
    ).toThrowError('privileged_browser_credential_rejected')

    expect(() =>
      assertBrowserSafeViteEnv({
        SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_server_only_is_not_bundled',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).not.toThrow()
  })
})
