import { expect, test } from '@playwright/test'

import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'

/*
 * The website's home page (`/`): the landing page for guests (src/app/(site), see site-routing.e2e.spec.ts) and members
 * (src/app/(payload)/[[...segments]]/page.tsx). Admins get the Payload dashboard there instead (see admin.e2e.spec.ts).
 *
 * Both layouts load Payload's font and colour tokens (light / dark theme) on purpose: the note pages use them, so
 * Payload's fonts and styles being present on `/` is expected and not tested against.
 */

const BASE = 'http://localhost:3000'
const member: TestAccount = {
  password: 'e2e-pass-1234',
  role: 'user',
  username: `e2e-frontend-${Date.now().toString(36)}`,
}

test.describe('Frontend', () => {
  test('can go on homepage', async ({ page }) => {
    await page.goto(BASE)

    await expect(page).toHaveTitle('Website Lending Page')
    await expect(page.getByText('Website Lending Page')).toBeVisible()
  })

  test('guests get the website, not the Payload admin (no dashboard, no login redirect)', async ({ page }) => {
    const response = await page.goto(BASE)

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(`${BASE}/`)
    await expect(page.locator('.dashboard')).toHaveCount(0)
    await expect(page.locator('form.login__form')).toHaveCount(0)
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  })

  test('the homepage loads without errors', async ({ page }) => {
    const problems: string[] = []
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`))
    page.on('response', (response) => {
      if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`)
    })

    await page.goto(BASE)
    await page.waitForLoadState('networkidle')

    expect(problems).toEqual([])
  })

  test('a logged-in member (user role) also gets the website on /', async ({ page }) => {
    await seedAccount(member)
    await loginAs(page, member)

    await page.goto(BASE)
    await expect(page).toHaveURL(`${BASE}/`)
    await expect(page.getByText('Website Lending Page')).toBeVisible()
    await expect(page.locator('.dashboard')).toHaveCount(0)

    await deleteAccount(member.username)
  })
})
