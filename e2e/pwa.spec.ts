import { expect, test } from '@playwright/test'

import { hasAuth0E2eCredentials } from './fixtures/auth'

test.describe('pwa and quiet notifications', () => {
  test.skip(
    !hasAuth0E2eCredentials(),
    'Authenticated E2E needs the Auth0 test identity in E2E_AUTH0_EMAIL / E2E_AUTH0_PASSWORD',
  )

  test('installable manifest and settings explain notifications without prompting on inbox', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByTestId('convex-session')).toHaveAttribute('data-state', 'ready', {
      timeout: 20_000,
    })
    await expect(page.getByRole('heading', { name: '届いた手紙' })).toBeVisible()

    const permissionProbe = page.waitForEvent('dialog', { timeout: 1_000 }).then(
      () => 'prompted',
      () => 'quiet',
    )
    expect(await permissionProbe).toBe('quiet')

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(manifestHref).toBe('/manifest.webmanifest')
    const manifest = await page.request.get('/manifest.webmanifest')
    expect(manifest.ok()).toBe(true)
    const body = await manifest.json()
    expect(body.theme_color).toBe('#f4f8fc')
    expect(body.display).toBe('standalone')

    const sw = await page.request.get('/sw.js')
    expect(sw.ok()).toBe(true)
    const icon192 = await page.request.get('/icons/icon-192.png')
    const icon512 = await page.request.get('/icons/icon-512.png')
    expect(icon192.ok()).toBe(true)
    expect(icon512.ok()).toBe(true)

    await page.getByRole('link', { name: '設定' }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { name: '設定' })).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByText(
        '届いた手紙を忘れないよう、静かな通知だけ送ります。本文や写真は通知に出しません。',
      ),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: '届いた手紙' })).toHaveCount(0)
  })
})
