import { expect, test } from '@playwright/test'

const googleSmokeEnabled = process.env.E2E_GOOGLE_SMOKE === '1'

test.describe('Google OAuth smoke', () => {
  test.skip(
    !googleSmokeEnabled,
    'Set E2E_GOOGLE_SMOKE=1 to run the Google OAuth smoke against the Auth0 DEV connection',
  )

  test('starts Google OAuth from the login screen without embedding secrets', async ({ page }) => {
    await page.goto('/login')

    const popupPromise = page.waitForEvent('popup', { timeout: 15_000 }).catch(() => null)
    await page.getByRole('button', { name: 'Googleで続ける' }).click()
    const popup = await popupPromise

    // Completing Google's hosted UI is a manual / opt-in smoke, not default CI.
    // This test only proves the Auth0 Google connection redirect starts.
    const target = popup ?? page
    await expect(target).toHaveURL(/accounts\.google\.com|[?&]connection=google-oauth2/, {
      timeout: 20_000,
    })
  })
})
