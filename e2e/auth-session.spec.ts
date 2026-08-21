import { expect, hasLocalAuthCredentials, test } from './fixtures/auth'

test.describe('authenticated local session', () => {
  test.skip(!hasLocalAuthCredentials(), 'Set E2E_AUTH_ENABLED=1 with local Supabase Auth running')

  test('restores a local session and opens the protected home route', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/')

    await expect(authenticatedPage).toHaveURL(/\/$/)
    await expect(authenticatedPage.getByRole('heading', { name: '未来のあなたへ' })).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: 'ログアウト' })).toBeVisible()
  })
})
