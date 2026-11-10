import { expect, type Page, test } from '@playwright/test'

import { login } from '../helpers/login'
import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

/*
 * Payload admin (`routes.admin: '/'`, admins only, see src/app/(payload)/[[...segments]]/page.tsx). Users log in with their
 * username (email login is off, src/collections/Users.ts).
 */

const BASE = 'http://localhost:3000'
const member: TestAccount = {
  password: 'e2e-pass-1234',
  role: 'user',
  username: `e2e-admin-member-${Date.now().toString(36)}`,
}

test.describe('Admin Panel', () => {
  let page: Page

  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    await seedAccount(member)

    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await page.context().close()
    await cleanupTestUser()
    await deleteAccount(member.username)
  })

  test('can navigate to dashboard', async () => {
    await page.goto(`${BASE}/?v=d`)
    await expect(page).toHaveURL(`${BASE}/?v=d`)
    await expect(page.locator('.dashboard')).toBeVisible()
    await expect(page.locator('.step-nav__first').first()).toBeVisible()
  })

  test('should load Payload admin styles and fonts', async () => {
    await page.goto(`${BASE}/?v=d`)

    const payloadFontFamily = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--text-body-family').trim(),
    )
    expect(payloadFontFamily).not.toBe('')

    // Payload loads Inter / Roboto Mono with `next/font/google`, which sets these variables.
    const nextFontFamily = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--font-family-sans').trim(),
    )
    expect(nextFontFamily).not.toBe('')
  })

  test('can navigate to list views (users, notes)', async () => {
    // Payload may add the list's saved preferences to the URL (e.g. `?limit=10`)
    await page.goto(`${BASE}/collections/users`)
    await expect(page).toHaveURL(new RegExp(`^${BASE}/collections/users(\\?.*)?$`))
    await expect(page.locator('h1', { hasText: 'Users' }).first()).toBeVisible()

    await page.goto(`${BASE}/collections/notes`)
    await expect(page).toHaveURL(new RegExp(`^${BASE}/collections/notes(\\?.*)?$`))
    await expect(page.locator('h1', { hasText: 'Notes' }).first()).toBeVisible()
  })

  test('can navigate to edit view: users have a username, not an email login', async () => {
    await page.goto(`${BASE}/collections/users/create`)
    await expect(page).toHaveURL(/\/collections\/users\/[a-zA-Z0-9-_]+/)
    await expect(page.locator('input[name="username"]')).toBeVisible()
  })

  test('account page shows the logged-in username', async () => {
    await page.goto(`${BASE}/account`)
    await expect(page.locator('input[name="username"]')).toHaveValue(testUser.username)
  })

  test('the website is still reachable for an admin with ?v=w', async () => {
    await page.goto(`${BASE}/?v=w`)
    await expect(page.getByText('Website Lending Page')).toBeVisible()
    await expect(page.locator('.dashboard')).toHaveCount(0)
  })

  test('logout ends the session: the admin pages ask for a login again', async () => {
    await page.goto(`${BASE}/logout`)
    await expect(page).not.toHaveURL(/\/logout/, { timeout: 30000 })
    await page.goto(`${BASE}/collections/users`)
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Admin login and access', () => {
  test('the login form asks for a username, not an email', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('#field-username')).toBeVisible()
    await expect(page.locator('#field-email')).toHaveCount(0)
  })

  test('logging in with an email address does not work (username only)', async ({ page }) => {
    const email = `${testUser.username}@example.com`
    await seedTestUser({ email })
    await page.goto(`${BASE}/login`)
    await page.fill('#field-username', email)
    await page.fill('#field-password', testUser.password)
    await page.click('button[type="submit"]')
    await expect(page.locator('.toast-error, [data-sonner-toast][data-type="error"]').first()).toBeVisible({ timeout: 20000 })
    await expect(page).toHaveURL(/\/login/)
    // The same account logs in with its username
    await login({ page, user: testUser })
    await cleanupTestUser()
  })

  test('a wrong password is refused and stays on the login page', async ({ page }) => {
    await seedTestUser()
    await page.goto(`${BASE}/login`)
    await page.fill('#field-username', testUser.username)
    await page.fill('#field-password', 'wrong-password')
    await page.click('button[type="submit"]')
    await expect(page.locator('.toast-error, [data-sonner-toast][data-type="error"]').first()).toBeVisible({ timeout: 20000 })
    await expect(page).toHaveURL(/\/login/)
    await cleanupTestUser()
  })

  test('a guest opening an admin page is sent to the login', async ({ page }) => {
    await page.goto(`${BASE}/collections/users`)
    await expect(page).toHaveURL(/\/login/)
  })

  test('a logged-in member (user role) never gets the admin: redirected to the website', async ({ page }) => {
    await seedAccount(member)
    await loginAs(page, member)
    for (const path of ['/collections/users', '/collections/notes', '/?v=d']) {
      await page.goto(`${BASE}${path}`)
      await expect(page).toHaveURL(`${BASE}/`)
      await expect(page.getByText('Website Lending Page')).toBeVisible()
      await expect(page.locator('.dashboard')).toHaveCount(0)
    }
    await deleteAccount(member.username)
  })
})
