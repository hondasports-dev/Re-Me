// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { createViteConfig } from '../../vite.config'

describe('Vite browser credential boundary', () => {
  it.each([
    'sb_secret_build_must_stop',
    `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`,
  ])('aborts config evaluation before a privileged key can enter public assets', (key) => {
    expect(() => createViteConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: key })).toThrowError(
      'privileged_browser_credential_rejected',
    )
  })

  it('rejects a privileged credential under any alternate VITE name', () => {
    expect(() =>
      createViteConfig({
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
        VITE_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_misconfigured',
      }),
    ).toThrowError('privileged_browser_credential_rejected')
  })
})
