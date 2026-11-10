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
let drawingNote: Note

/** A drawing with one rectangle (Excalidraw element format, as the editor saves it). */
const DRAWING = JSON.stringify({
  appState: {},
  elements: [
    {
      angle: 0, backgroundColor: 'transparent', boundElements: null, fillStyle: 'solid', frameId: null, groupIds: [],
      height: 80, id: 'rect-1', isDeleted: false, link: null, locked: false, opacity: 100, roughness: 1,
      roundness: null, seed: 1, strokeColor: '#1e1e1e', strokeStyle: 'solid', strokeWidth: 2, type: 'rectangle',
      updated: 1, version: 1, versionNonce: 1, width: 160, x: 0, y: 0,
    },
  ],
  files: {},
})

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await seedAccount(member)
  note = await seed.noteWithContent(
    noteWithCodeBlock(`E2E site routing ${RUN}`, { code: 'const answer = 42', filename: 'answer.ts', language: 'ts' }),
  )
  const content = noteWithCodeBlock(`E2E site drawing ${RUN}`, { code: 'x', language: 'plaintext' }) as unknown as {
    root: { children: unknown[] }
  }
  content.root.children.push({ type: 'excalidraw', data: DRAWING, version: 1 })
  drawingNote = await seed.noteWithContent(content as unknown as Note['note'])
})

/** Retries a local-API write while the server still holds the SQLite file's lock (e.g. right after the editor test). */
const whenUnlocked = async (write: () => Promise<unknown>) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await write()
    } catch (error) {
      if (attempt >= 10 || !String(error).includes('SQLITE_BUSY')) throw error
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
}

test.afterAll(async () => {
  await whenUnlocked(() => seed.cleanup())
  await whenUnlocked(() => deleteAccount(member.username))
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

test('guest drawing: rendered as an SVG when it scrolls into view', async ({ page }) => {
  const problems = watchProblems(page)
  await page.goto(`${BASE}/${drawingNote.slug}`)
  const preview = page.locator('.ink-excalidraw--readonly .ink-excalidraw-preview--rendered svg')
  await expect(preview).toBeVisible({ timeout: 30000 })
  await expect(preview.locator('path, rect').first()).toBeAttached()
  await expect(payloadLayout(page)).toHaveCount(0)
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
