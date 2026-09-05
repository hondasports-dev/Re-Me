import { expect, test } from '@playwright/test'

import { hasAuth0E2eCredentials } from './fixtures/auth'

test.describe('authenticated local session', () => {
  test.skip(
    !hasAuth0E2eCredentials(),
    'Authenticated E2E needs the Auth0 test identity in E2E_AUTH0_EMAIL / E2E_AUTH0_PASSWORD',
  )

  test('restores a session, keeps API authentication after reload, and hides data on logout', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: '受信箱' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'メインナビゲーション' })).toBeVisible()
    await expect(page.getByTestId('api-session')).toHaveAttribute('data-state', 'ready', {
      timeout: 20_000,
    })

    await page.reload()

    await expect(page.getByTestId('api-session')).toHaveAttribute('data-state', 'ready', {
      timeout: 20_000,
    })
    await expect(page.getByRole('heading', { name: '受信箱' })).toBeVisible()

    await page.getByRole('button', { name: 'ログアウト' }).click()

    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Googleで続ける' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '受信箱' })).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'メインナビゲーション' })).toHaveCount(0)
    await expect(page.getByTestId('api-session')).toHaveAttribute('data-state', 'idle')

    await page.goto('/')

    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: '受信箱' })).toHaveCount(0)
  })
})
