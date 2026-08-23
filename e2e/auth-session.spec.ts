import { expect, test } from '@playwright/test'

import { hasAuth0E2eCredentials } from './fixtures/auth'

test.describe('authenticated local session', () => {
  test.skip(
    !hasAuth0E2eCredentials(),
    'Authenticated E2E needs the Auth0 test identity in E2E_AUTH0_EMAIL / E2E_AUTH0_PASSWORD',
  )

  test('restores a local session and opens the protected home route', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: '届いた手紙' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'メインナビゲーション' })).toBeVisible()
  })
})
