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

    // Local smoke may navigate the same tab or open a provider popup depending on browser settings.
    const target = popup ?? page
    await expect(target).toHaveURL(/accounts\.google\.com|auth0\.com|\/authorize/, {
      timeout: 20_000,
    })
  })
})
