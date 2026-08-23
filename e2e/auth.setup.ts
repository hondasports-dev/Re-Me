import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { expect, test as setup } from '@playwright/test'

import { authStatePath, completeAuth0DatabaseLogin, hasAuth0E2eCredentials } from './fixtures/auth'

setup('authenticate with Auth0 test identity', async ({ page }) => {
  setup.skip(
    !hasAuth0E2eCredentials(),
    'Authenticated E2E needs E2E_AUTH0_EMAIL and E2E_AUTH0_PASSWORD',
  )
  setup.setTimeout(90_000)

  await mkdir(path.dirname(authStatePath), { recursive: true })
  await page.goto('/login?e2e_db=1')
  await completeAuth0DatabaseLogin(
    page,
    process.env.E2E_AUTH0_EMAIL ?? '',
    process.env.E2E_AUTH0_PASSWORD ?? '',
  )

  await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible({
    timeout: 30_000,
  })
  await page.context().storageState({ path: authStatePath })
})
