import { expect, test, type Page } from '@playwright/test'

import { hasAuth0E2eCredentials } from './fixtures/auth'

const letterBody = `未来を旅する手紙 ${Date.now()}`

test.describe('traveling letters', () => {
  test.skip(
    !hasAuth0E2eCredentials(),
    'Authenticated E2E needs the Auth0 test identity in E2E_AUTH0_EMAIL / E2E_AUTH0_PASSWORD',
  )

  test('lists an unsealed traveling letter, lets the owner reread it, and deletes it', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await openAuthenticatedInbox(page)

    await page.getByRole('link', { name: '旅する手紙' }).click()
    await expect(page).toHaveURL(/\/traveling$/)
    const ambientMotion = await page
      .locator('.traveling-list__item-art img')
      .first()
      .evaluate((element) => {
        const style = window.getComputedStyle(element)
        return {
          animationIterationCount: style.animationIterationCount,
          animationName: style.animationName,
        }
      })
    expect(ambientMotion.animationName).toBe('re-me-plane-travel')
    expect(ambientMotion.animationIterationCount).toBe('infinite')
    const existingHrefs = await readableLetterHrefs(page)

    await page.getByRole('link', { name: '書く' }).click()
    await expect(page).toHaveURL(/\/write\/[^/]+$/, { timeout: 20_000 })

    const body = page.getByRole('textbox', { name: '本文' })
    await expect(body).toBeVisible({ timeout: 20_000 })
    await body.fill(letterBody)
    await page.getByRole('button', { name: '次へ' }).click()

    await expect(page).toHaveURL(/\/write\/[^/]+\/send$/, { timeout: 20_000 })
    await page.getByRole('radio', { name: '数週間後くらい' }).check()
    await page.getByRole('radio', { name: /封をしない/ }).check()
    await page.getByRole('button', { name: '未来へ送る' }).click()

    await expect(page).toHaveURL(/\/traveling$/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: '未来を旅する手紙' })).toBeVisible()
    await expect(page.getByText(letterBody)).toHaveCount(0)

    await expect
      .poll(
        async () =>
          (await readableLetterHrefs(page)).some(
            (href) => href !== null && !existingHrefs.includes(href),
          ),
        { timeout: 20_000 },
      )
      .toBe(true)

    const createdHref = (await readableLetterHrefs(page)).find(
      (href) => href !== null && !existingHrefs.includes(href),
    )
    expect(createdHref).toBeTruthy()

    const overflowing = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflowing).toBe(false)

    await page.locator(`a[href="${createdHref}"]`).click()
    await expect(page).toHaveURL(/\/traveling\/[^/]+$/)
    await expect(page.getByText(letterBody)).toBeVisible()
    await expect(page.getByRole('textbox', { name: '本文' })).toHaveCount(0)

    await page.getByRole('button', { name: 'この手紙を削除する' }).click()
    await expect(page.getByRole('alertdialog', { name: 'この手紙を削除しますか' })).toBeVisible()
    await expect(page.getByRole('button', { name: '削除する' })).toBeFocused()
    await page.getByRole('button', { name: '削除する' }).click()

    await expect(page).toHaveURL(/\/traveling$/, { timeout: 20_000 })
    await expect(page.locator(`a[href="${createdHref}"]`)).toHaveCount(0)
  })
})

async function readableLetterHrefs(page: Page): Promise<Array<string | null>> {
  return await page
    .getByRole('link', { name: /読み返せる/ })
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
}

async function openAuthenticatedInbox(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('api-session')).toHaveAttribute('data-state', 'ready', {
    timeout: 20_000,
  })
  await expect(page.getByRole('heading', { name: '受信箱' })).toBeVisible()
}
