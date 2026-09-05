// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { createViteConfig } from '../../vite.config'

describe('Vite browser credential boundary', () => {
  it('binds local development to the Auth0 callback origin', () => {
    expect(createViteConfig({}).server?.host).toBe('127.0.0.1')
  })

  it.each([
    'sb_secret_build_must_stop',
    `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`,
  ])('aborts config evaluation before a privileged key can enter public assets', (key) => {
    expect(() => createViteConfig({ VITE_PUBLIC_TOKEN: key })).toThrowError(
      'privileged_browser_credential_rejected',
    )
  })

  it('rejects a privileged credential under any alternate VITE name', () => {
    expect(() =>
      createViteConfig({
        VITE_AUTH0_CLIENT_ID: 'spa-client-id',
        VITE_SERVICE_ROLE_KEY: 'sb_secret_misconfigured',
      }),
    ).toThrowError('privileged_browser_credential_rejected')
  })
})
