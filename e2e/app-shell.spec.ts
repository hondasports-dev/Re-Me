import { expect, test } from '@playwright/test'

test('redirects an anonymous visitor to the login screen', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Re:Me — 未来のあなたへ')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: '未来のあなたへ' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Googleで続ける' })).toBeVisible()
  await expect(page.getByText('Invalid PrimeUI License')).toHaveCount(0)
})

test('shows a finite callback error without redirecting back to Google', async ({ page }) => {
  await page.goto('/auth/callback?error=access_denied&error_description=sensitive-provider-detail')

  await expect(page).toHaveURL(/\/auth\/callback$/)
  await expect(page.getByRole('heading', { name: 'ログインを完了できませんでした' })).toBeVisible()
  await expect(page.getByText('sensitive-provider-detail')).toHaveCount(0)
})
