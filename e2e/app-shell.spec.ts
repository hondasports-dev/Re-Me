import { expect, test } from '@playwright/test'

test('renders the mobile-first app shell', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Re:Me — 未来のあなたへ')
  await expect(page.getByRole('heading', { name: '未来のあなたへ' })).toBeVisible()
})
