import { expect, test, type Page } from '@playwright/test'
import { encode } from 'jpeg-js'

import { hasAuth0E2eCredentials } from './fixtures/auth'

const letterBody = '未来の自分へ、今日の気持ちを残す。'

test.describe('compose draft editor', () => {
  test.skip(
    !hasAuth0E2eCredentials(),
    'Authenticated E2E needs the Auth0 test identity in E2E_AUTH0_EMAIL / E2E_AUTH0_PASSWORD',
  )

  test('writes a draft, keeps attachments optional, and reaches delivery settings', async ({
    page,
  }) => {
    await openAuthenticatedInbox(page)

    await page.getByRole('link', { name: '書く' }).click()

    await expect(page).toHaveURL(/\/write\/[^/]+$/, { timeout: 20_000 })
    const body = page.getByRole('textbox', { name: '本文' })
    await expect(body).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: '手紙を書く' })).toBeVisible()
    await expect(page.getByRole('button', { name: '次へ' })).toBeDisabled()
    await expect(page.getByRole('button', { name: '写真を添える（0/3）' })).toBeEnabled()

    await body.fill(letterBody)
    await expect(page.getByRole('button', { name: '次へ' })).toBeEnabled()

    await page.getByRole('textbox', { name: '場所の名前' }).fill('鴨川')
    await page.getByRole('button', { name: '場所を残す' }).click()
    await expect(page.getByText('鴨川')).toBeVisible()
    await expect(page.getByRole('button', { name: '場所を外す' })).toBeVisible()

    await page.getByRole('button', { name: '場所を外す' }).click()
    await expect(page.getByRole('textbox', { name: '場所の名前' })).toBeVisible()
    await expect(page.getByRole('button', { name: '場所を残す' })).toBeDisabled()

    await page.getByRole('button', { name: '次へ' }).click()

    await expect(page).toHaveURL(/\/write\/[^/]+\/send$/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: '届ける時期と封' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '数日後くらい' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '数週間後くらい' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '数か月後くらい' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '1年後くらい' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '未来に任せる' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /封をする/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /封をしない/ })).toBeVisible()
    await expect(page.getByRole('button', { name: '未来へ送る' })).toBeDisabled()

    await page.getByRole('radio', { name: '数週間後くらい' }).check()
    await expect(page.getByRole('radio', { name: '数週間後くらい' })).toBeChecked()

    await page.getByRole('radio', { name: /封をしない/ }).check()
    await expect(page.getByRole('radio', { name: /封をしない/ })).toBeChecked()
    await expect(page.getByRole('button', { name: '未来へ送る' })).toBeDisabled()
  })

  test('autosaves the body so a reload restores the draft', async ({ page }) => {
    await openAuthenticatedInbox(page)

    await page.getByRole('link', { name: '書く' }).click()

    await expect(page).toHaveURL(/\/write\/[^/]+$/, { timeout: 20_000 })
    const body = page.getByRole('textbox', { name: '本文' })
    await expect(body).toBeVisible({ timeout: 20_000 })

    await body.fill(letterBody)
    await expect(page.getByText('下書きを残しました')).toBeVisible({ timeout: 15_000 })

    await page.reload()

    await expect(page.getByRole('textbox', { name: '本文' })).toHaveValue(letterBody, {
      timeout: 20_000,
    })
  })

  test('uploads, reads, and removes a private photo attachment', async ({ page }) => {
    test.setTimeout(60_000)
    await openAuthenticatedInbox(page)

    await page.getByRole('link', { name: '書く' }).click()
    await expect(page).toHaveURL(/\/write\/[^/]+$/, { timeout: 20_000 })

    const rgba = Buffer.alloc(8 * 8 * 4)
    for (let offset = 0; offset < rgba.length; offset += 4) {
      rgba[offset] = 120
      rgba[offset + 1] = 72
      rgba[offset + 2] = 96
      rgba[offset + 3] = 255
    }
    const jpeg = encode({ data: rgba, width: 8, height: 8 }, 85).data

    await page.locator('input[type="file"]').setInputFiles({
      buffer: Buffer.from(jpeg),
      mimeType: 'image/jpeg',
      name: 're-me-e2e.jpg',
    })

    await expect(page.getByRole('img', { name: '添付写真 1' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: '写真を添える（1/3）' })).toBeEnabled()

    await page.getByRole('button', { name: '外す' }).click()
    await expect(page.getByRole('img', { name: '添付写真 1' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '写真を添える（0/3）' })).toBeEnabled()
  })
})

async function openAuthenticatedInbox(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('convex-session')).toHaveAttribute('data-state', 'ready', {
    timeout: 20_000,
  })
  await expect(page.getByRole('heading', { name: '届いた手紙' })).toBeVisible()
}
