import { type Page } from '@playwright/test'
import path from 'node:path'

export const authStatePath = path.join('e2e', '.auth', 'user.json')

export function hasAuth0E2eCredentials(): boolean {
  return Boolean(process.env.E2E_AUTH0_EMAIL && process.env.E2E_AUTH0_PASSWORD)
}

export async function completeAuth0DatabaseLogin(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.waitForURL(/auth0\.com/, { timeout: 30_000 })

  const identifier = page
    .locator('input[name="username"], input[name="email"], input[type="email"]')
    .first()
  await identifier.waitFor({ state: 'visible', timeout: 30_000 })
  await identifier.fill(email)

  const passwordInput = page.locator('input[name="password"], input[type="password"]')
  const passwordVisible = await passwordInput
    .first()
    .isVisible()
    .catch(() => false)

  if (!passwordVisible) {
    await page.getByRole('button', { name: /continue|続ける|next/i }).click()
    await passwordInput.first().waitFor({ state: 'visible', timeout: 30_000 })
  }

  await passwordInput.first().fill(password)
  await page.getByRole('button', { name: /continue|続ける|log in|ログイン|submit/i }).click()
}
