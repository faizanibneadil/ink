import { expect, type Page, test } from '@playwright/test'

import type { Note } from '../../src/payload-types.js'
import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'
import { createNoteSeeder } from '../helpers/seedNotes'

/*
 * Autosave on the note page editor (src/views/note-autosave): debounced PATCH /api/notes/:id with the content only.
 * Every test uses its own note, logged in as a `user`-role member (not an admin).
 */

const BASE = 'http://localhost:3000'
const RUN = Date.now().toString(36)
const seed = createNoteSeeder()
const member: TestAccount = { password: 'e2e-pass-1234', role: 'user', username: `e2e-autosave-${RUN}` }

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await seedAccount(member)
})

test.afterAll(async () => {
  await seed.cleanup()
  await deleteAccount(member.username)
})

const status = (page: Page) => page.getByTestId('note-save-status')
const editable = (page: Page) => page.locator('.note-page--editor [contenteditable="true"]')

/** PATCH requests to the notes REST API made by the page. */
const trackSaves = (page: Page) => {
  const saves: { body: string; url: string }[] = []
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().includes('/api/notes/')) {
      saves.push({ body: request.postData() ?? '', url: request.url() })
    }
  })
  return saves
}

const openNote = async (page: Page, note: Note) => {
  await loginAs(page, member)
  await page.goto(`${BASE}/${note.slug}`)
  await expect(editable(page)).toBeVisible({ timeout: 60000 })
}

/** Puts the caret at the end of the note's last paragraph. */
const caretAtEnd = async (page: Page) => {
  await editable(page).locator('p').last().click()
  await page.keyboard.press('End')
}

/** The note as stored (public REST read). */
const stored = async (page: Page, id: number) => {
  const response = await page.request.get(`${BASE}/api/notes/${id}?depth=0`)
  expect(response.ok()).toBe(true)
  return (await response.json()) as Note
}

test.describe('Note autosave', () => {
  test('opening a note saves nothing', async ({ page }) => {
    const note = await seed.note(`E2E autosave open ${RUN}`)
    const saves = trackSaves(page)
    await openNote(page, note)
    await page.waitForTimeout(3000)
    expect(saves).toHaveLength(0)
    await expect(status(page)).toHaveAttribute('data-state', 'idle')
  })

  test('typing is saved once after a pause; it is there after a reload; the URL (slug) stays the same', async ({ page }) => {
    const note = await seed.note(`E2E autosave typing ${RUN}`)
    const saves = trackSaves(page)
    await openNote(page, note)
    await caretAtEnd(page)
    const typed = ` typed-${RUN}`
    // A quick burst of typing (well under the 1s pause)
    await page.keyboard.type(typed, { delay: 15 })
    await expect(status(page)).toHaveAttribute('data-state', /pending|saving/)
    await expect(status(page)).toHaveAttribute('data-state', 'saved', { timeout: 15000 })
    await expect(status(page)).toHaveText('Saved')

    // One request for the whole burst, with the content only
    expect(saves).toHaveLength(1)
    expect(saves[0].url).toContain(`/api/notes/${note.id}`)
    expect(Object.keys(JSON.parse(saves[0].body))).toEqual(['note'])

    const saved = await stored(page, note.id)
    expect(JSON.stringify(saved.note)).toContain(typed.trim())
    expect(saved.slug).toBe(note.slug)

    await page.reload()
    await expect(editable(page)).toContainText(typed.trim(), { timeout: 60000 })
    expect(new URL(page.url()).pathname).toBe(`/${note.slug}`)
  })

  test('a failed save shows the error and Retry; Retry saves it', async ({ page }) => {
    const note = await seed.note(`E2E autosave error ${RUN}`)
    await openNote(page, note)
    await page.route('**/api/notes/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback()
      await route.fulfill({
        body: JSON.stringify({ errors: [{ message: 'Something went wrong.' }] }),
        contentType: 'application/json',
        status: 500,
      })
    })
    await caretAtEnd(page)
    await page.keyboard.type(' will-fail-first')
    await expect(status(page)).toHaveAttribute('data-state', 'error', { timeout: 15000 })
    await expect(status(page)).toContainText('Something went wrong.')
    const retry = status(page).getByRole('button', { name: 'Retry' })
    await expect(retry).toBeVisible()
    // Nothing reached the database
    expect(JSON.stringify((await stored(page, note.id)).note)).not.toContain('will-fail-first')

    await page.unroute('**/api/notes/*')
    await retry.click()
    await expect(status(page)).toHaveAttribute('data-state', 'saved', { timeout: 15000 })
    expect(JSON.stringify((await stored(page, note.id)).note)).toContain('will-fail-first')
  })

  test('signed out while editing: a clear message, nothing saved', async ({ page }) => {
    const note = await seed.note(`E2E autosave signed out ${RUN}`)
    await openNote(page, note)
    await page.context().clearCookies()
    await caretAtEnd(page)
    await page.keyboard.type(' no-session')
    await expect(status(page)).toHaveAttribute('data-state', 'error', { timeout: 15000 })
    await expect(status(page)).toContainText('You are signed out')
    expect(JSON.stringify((await stored(page, note.id)).note)).not.toContain('no-session')
  })

  test('hiding the page (tab switch / app switch) saves at once, without waiting for the pause', async ({ page }) => {
    const note = await seed.note(`E2E autosave hidden ${RUN}`)
    const saves = trackSaves(page)
    await openNote(page, note)
    await caretAtEnd(page)
    await page.keyboard.type(' saved-on-hide')
    // Lexical hands the change over in idle time; then the page is hidden before the 1s pause is over
    await expect(status(page)).toHaveAttribute('data-state', 'pending')
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(() => saves.length, { timeout: 500 }).toBe(1)
    await expect.poll(async () => JSON.stringify((await stored(page, note.id)).note)).toContain('saved-on-hide')
  })

  test('leaving right after typing asks first, and every letter typed is saved', async ({ page }) => {
    const note = await seed.note(`E2E autosave leave ${RUN}`)
    await openNote(page, note)
    await caretAtEnd(page)
    await page.keyboard.type(' saved-on-leave')
    // Close right away: Payload has not handed the last letters to the autosave yet (it does so in idle time), so the
    // page must read them from the editor itself
    const dialog = page.waitForEvent('dialog')
    await page.close({ runBeforeUnload: true })
    const shown = await dialog
    expect(shown.type()).toBe('beforeunload')
    await shown.accept()
    await expect
      .poll(async () => {
        const response = await fetch(`${BASE}/api/notes/${note.id}?depth=0`)
        return JSON.stringify(((await response.json()) as Note).note)
      })
      .toContain('saved-on-leave')
  })

  test('a guest has no save status (read-only page)', async ({ browser }) => {
    const note = await seed.note(`E2E autosave guest ${RUN}`)
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${BASE}/${note.slug}`)
    await expect(page.locator('.note-view')).toBeVisible()
    await expect(status(page)).toHaveCount(0)
    await context.close()
  })
})
