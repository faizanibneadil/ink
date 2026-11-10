import { expect, type Page, test } from '@playwright/test'

import type { Note } from '../../src/payload-types.js'
import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'
import { createNoteSeeder, noteWithCodeBlock } from '../helpers/seedNotes'

/*
 * Guests get the website pages (`/`, `/<slug>`) from the light layout in src/app/(site) (src/proxy.ts rewrites them,
 * same URL); logged-in users and every Payload page keep Payload's RootLayout. See docs/bundle/AUDIT.md.
 */

const BASE = 'http://localhost:3000'
const RUN = Date.now().toString(36)
const seed = createNoteSeeder()
const member: TestAccount = { password: 'e2e-pass-1234', role: 'user', username: `e2e-site-${RUN}` }
let note: Note

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await seedAccount(member)
  note = await seed.noteWithContent(
    noteWithCodeBlock(`E2E site routing ${RUN}`, { code: 'const answer = 42', filename: 'answer.ts', language: 'ts' }),
  )
})

test.afterAll(async () => {
  await seed.cleanup()
  await deleteAccount(member.username)
})

const watchProblems = (page: Page) => {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`)
  })
  return problems
}

/** Payload's RootLayout renders its modal container; the website layout does not. */
const payloadLayout = (page: Page) => page.locator('.payload__modal-container')

test('guest note page: website layout, same URL, highlighted code and Copy', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const problems = watchProblems(page)
  const response = await page.goto(`${BASE}/${note.slug}`)

  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL(`${BASE}/${note.slug}`)
  await expect(page).toHaveTitle(`E2E site routing ${RUN}`)
  await expect(page.locator('.note-view h1')).toHaveText(`E2E site routing ${RUN}`)
  await expect(page.locator('.note-view__codeblock .hljs-keyword').first()).toHaveText('const')
  await expect(page.locator('.note-view__codeblock-lang')).toHaveText('answer.ts · TypeScript')
  await expect(payloadLayout(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Copy code' }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('const answer = 42')
  expect(problems).toEqual([])
})

test('guest theme: Payload theme cookie, else light (as Payload gave guests)', async ({ browser }) => {
  // Payload's ThemeProvider does not follow the system theme for guests (no `admin.theme` in their client config)
  const system = await browser.newContext({ colorScheme: 'dark' })
  const systemPage = await system.newPage()
  await systemPage.goto(`${BASE}/${note.slug}`)
  await systemPage.waitForLoadState('networkidle')
  await expect(systemPage.locator('html')).toHaveAttribute('data-theme', 'light')
  await system.close()

  const cookie = await browser.newContext()
  await cookie.addCookies([{ name: 'payload-theme', url: BASE, value: 'dark' }])
  const cookiePage = await cookie.newPage()
  await cookiePage.goto(`${BASE}/${note.slug}`)
  await cookiePage.waitForLoadState('networkidle')
  await expect(cookiePage.locator('html')).toHaveAttribute('data-theme', 'dark')
  await cookie.close()
})

test('guest 404s: unknown note, and the internal /site prefix', async ({ page }) => {
  for (const path of [`/no-such-note-${RUN}`, '/site', `/site/${note.slug}`]) {
    const response = await page.goto(`${BASE}${path}`)
    expect(response?.status(), path).toBe(404)
    await expect(page.getByText('Nothing found')).toBeVisible()
  }
})

test('guest Payload pages keep Payload (login)', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await expect(payloadLayout(page)).toHaveCount(1)
  await expect(page.locator('#field-username')).toBeVisible()
})

test('logged in: the same URL is the editor in Payload’s layout', async ({ page }) => {
  await loginAs(page, member)
  await page.goto(`${BASE}/${note.slug}`)
  await expect(page.locator('[data-lexical-editor="true"]')).toBeVisible({ timeout: 60000 })
  await expect(payloadLayout(page)).toHaveCount(1)
})
