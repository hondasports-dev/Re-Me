import { expect, test, type Page } from '@playwright/test'

import { hasAuth0E2eCredentials } from './fixtures/auth'

test.describe('reply and thread', () => {
  test.skip(
    !hasAuth0E2eCredentials(),
    'Authenticated E2E needs the Auth0 test identity in E2E_AUTH0_EMAIL / E2E_AUTH0_PASSWORD',
  )

  test('opens a delivered letter, replies to the future, and shows a one-path thread', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openAuthenticatedInbox(page)
    const parentBody = `返信の親 ${Date.now()}`
    const replyBody = `未来への返信 ${Date.now()}`
    const letterId = await sendTravelingLetter(page, { body: parentBody, sealed: true })

    await page.goto(`/traveling/${letterId}`)
    await expect(page.getByRole('heading', { name: '封をしている' })).toBeVisible({
      timeout: 20_000,
    })
    await clickForceDeliver(page)

    await expect(page).toHaveURL(new RegExp(`/letters/${letterId}$`), { timeout: 20_000 })
    await page.getByRole('button', { name: '開封する' }).click()
    await expect(page.getByText(parentBody)).toBeVisible()

    await page.getByRole('link', { name: '未来へ返信する' }).click()
    await expect(page).toHaveURL(new RegExp(`/letters/${letterId}/reply$`))
    await expect(page.getByRole('heading', { level: 1, name: '未来へ返信する' })).toBeVisible({
      timeout: 20_000,
    })

    const editor = page.getByRole('textbox', { name: '本文' })
    await expect(editor).toBeVisible({ timeout: 20_000 })
    await editor.fill(replyBody)
    await page.getByRole('button', { name: '次へ' }).click()

    await expect(page).toHaveURL(new RegExp(`/letters/${letterId}/reply/send$`))
    await page.getByRole('radio', { name: '数週間後くらい' }).check()
    await page.getByRole('radio', { name: /封をする/ }).check()
    await page.getByRole('button', { name: '未来へ送る' }).click()
    await expect(page).toHaveURL(/\/traveling$/, { timeout: 20_000 })
    await expect(page.getByText(replyBody)).toHaveCount(0)

    await page.goto(`/letters/${letterId}`)
    await expect(page.getByRole('link', { name: '未来へ返信する' })).toHaveCount(0)
    await page.getByRole('link', { name: '時間をまたぐ手紙' }).click()
    await expect(page.getByRole('heading', { level: 1, name: '時間をまたぐ手紙' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(parentBody)).toBeVisible()
    await expect(page.getByText(replyBody)).toHaveCount(0)
    await expect(
      page.getByText('未来を旅しているあいだは、封をした本文は見えません。'),
    ).toBeVisible()
  })
})

async function clickForceDeliver(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'E2E: 今すぐ届ける' })
  await expect(button).toBeVisible()
  await button.scrollIntoViewIfNeeded()
  await button.click()
}

async function sendTravelingLetter(
  page: Page,
  options: { body: string; sealed: boolean },
): Promise<string> {
  await page.getByRole('link', { name: '書く' }).click()
  await expect(page).toHaveURL(/\/write\/[^/]+$/, { timeout: 20_000 })

  const editor = page.getByRole('textbox', { name: '本文' })
  await expect(editor).toBeVisible({ timeout: 20_000 })
  await editor.fill(options.body)
  await page.getByRole('button', { name: '次へ' }).click()

  await expect(page).toHaveURL(/\/write\/[^/]+\/send$/, { timeout: 20_000 })
  await page.getByRole('radio', { name: '数週間後くらい' }).check()
  await page.getByRole('radio', { name: options.sealed ? /封をする/ : /封をしない/ }).check()

  const letterId = page.url().match(/\/write\/([^/]+)\/send/)?.[1]
  expect(letterId).toBeTruthy()

  await page.getByRole('button', { name: '未来へ送る' }).click()
  await expect(page).toHaveURL(/\/traveling$/, { timeout: 20_000 })
  return letterId as string
}

async function openAuthenticatedInbox(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('convex-session')).toHaveAttribute('data-state', 'ready', {
    timeout: 20_000,
  })
  await expect(page.getByRole('heading', { name: '受信箱' })).toBeVisible()
}
