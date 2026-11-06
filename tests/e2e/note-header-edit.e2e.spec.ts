import fs from 'node:fs'

import { expect, type Page, test } from '@playwright/test'

import type { Media, Note } from '../../src/payload-types.js'
import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'
import { createNoteSeeder, FIXTURE_IMAGES } from '../helpers/seedNotes'

/*
 * Editing the note header on `/<slug>` (src/views/note-header/EditableNoteHeader.tsx): add / change the cover and the
 * icon by uploading an image. Logged in as a `user`-role member. Every test uses its own note.
 */

const BASE = 'http://localhost:3000'
const RUN = Date.now().toString(36)
const seed = createNoteSeeder()
const member: TestAccount = { password: 'e2e-pass-1234', role: 'user', username: `e2e-header-${RUN}` }

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await seedAccount(member)
})

test.afterAll(async () => {
  await seed.cleanup()
  await deleteAccount(member.username)
})

const header = (page: Page) => page.getByTestId('note-header')
const picker = (page: Page) => page.getByTestId('note-image-picker')
const fileInput = (page: Page) => picker(page).locator('input[type="file"]')
const editable = (page: Page) => page.locator('.note-page--editor [contenteditable="true"]')

/** Media files the page uploads, so the test removes them afterwards. */
const trackUploads = (page: Page) => {
  const uploads: Media[] = []
  page.on('response', async (response) => {
    if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/media' && response.ok()) {
      const { doc } = (await response.json()) as { doc: Media }
      uploads.push(doc)
      seed.adopt('media', doc.id)
    }
  })
  return uploads
}

const openNote = async (page: Page, note: Note) => {
  await loginAs(page, member)
  await page.goto(`${BASE}/${note.slug}`)
  await expect(editable(page)).toBeVisible({ timeout: 60000 })
}

const storedNote = async (page: Page, id: number) =>
  (await (await page.request.get(`${BASE}/api/notes/${id}?depth=1`)).json()) as Note

test.describe('Edit the note header', () => {
  test('add a cover and an icon: shown at once, saved, alt text from the title, seen by guests', async ({ browser, page }) => {
    const title = `E2E header add ${RUN}`
    const note = await seed.note(title)
    const uploads = trackUploads(page)
    await openNote(page, note)

    await expect(page.getByTestId('note-cover')).toHaveCount(0)
    await header(page).hover()
    await expect(page.getByTestId('add-cover')).toBeVisible()
    await expect(page.getByTestId('add-icon')).toBeVisible()

    await page.getByTestId('add-cover').click()
    await expect(picker(page)).toBeVisible()
    await expect(picker(page).getByRole('tab', { name: 'Upload' })).toBeVisible()
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.cover)
    await expect(picker(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.locator('[data-testid="note-cover"] img')).toHaveAttribute('src', /\/api\/media\/file\//)

    await header(page).hover()
    await page.getByTestId('add-icon').click()
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.icon)
    await expect(picker(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.locator('[data-testid="note-icon"] img')).toHaveAttribute('src', /\/api\/media\/file\//)
    // Both set: no "Add …" buttons left
    await expect(page.getByTestId('note-header-add')).toHaveCount(0)

    // Stored on the note, with the alt text made from the title
    expect(uploads.map((upload) => upload.alt)).toEqual([`${title} – cover`, `${title} – icon`])
    const saved = await storedNote(page, note.id)
    expect((saved.cover as Media).id).toBe(uploads[0].id)
    expect((saved.icon as Media).id).toBe(uploads[1].id)
    expect(saved.slug).toBe(note.slug)

    // Still there after a reload, and for a guest
    await page.reload()
    await expect(page.locator('[data-testid="note-cover"] img')).toHaveAttribute('src', uploads[0].url as string)
    const guestContext = await browser.newContext()
    const guest = await guestContext.newPage()
    await guest.goto(`${BASE}/${note.slug}`)
    await expect(guest.locator('[data-testid="note-icon"] img')).toHaveAttribute('src', uploads[1].url as string)
    await expect(guest.getByTestId('note-header').locator('button')).toHaveCount(0)
    await guestContext.close()
  })

  test('change an existing cover and icon', async ({ page }) => {
    const oldCover = await seed.media(FIXTURE_IMAGES.cover, `E2E old cover ${RUN}`)
    const oldIcon = await seed.media(FIXTURE_IMAGES.icon, `E2E old icon ${RUN}`)
    const note = await seed.note(`E2E header change ${RUN}`, { cover: oldCover.id, icon: oldIcon.id })
    const uploads = trackUploads(page)
    await openNote(page, note)

    await page.getByTestId('note-cover').hover()
    await page.getByTestId('change-cover').click()
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.icon)
    await expect(picker(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.locator('[data-testid="note-cover"] img')).toHaveAttribute('src', uploads[0].url as string)

    await page.getByRole('button', { name: 'Change icon' }).click()
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.cover)
    await expect(picker(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.locator('[data-testid="note-icon"] img')).toHaveAttribute('src', uploads[1].url as string)

    const saved = await storedNote(page, note.id)
    expect((saved.cover as Media).id).toBe(uploads[0].id)
    expect((saved.icon as Media).id).toBe(uploads[1].id)
  })

  test('a file that is not an image, or too large, is refused before uploading', async ({ page }) => {
    const note = await seed.note(`E2E header refuse ${RUN}`)
    const uploads = trackUploads(page)
    let mediaRequests = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/media') mediaRequests++
    })
    await openNote(page, note)
    await header(page).hover()
    await page.getByTestId('add-cover').click()

    await fileInput(page).setInputFiles({ buffer: Buffer.from('not an image'), mimeType: 'text/plain', name: 'notes.txt' })
    await expect(picker(page).getByRole('alert')).toHaveText('Choose an image file (PNG, JPEG, GIF, WebP or AVIF).')

    await fileInput(page).setInputFiles({
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      mimeType: 'image/svg+xml',
      name: 'icon.svg',
    })
    await expect(picker(page).getByRole('alert')).toHaveText('Choose an image file (PNG, JPEG, GIF, WebP or AVIF).')

    const big = Buffer.alloc(10 * 1024 * 1024 + 1)
    fs.readFileSync(FIXTURE_IMAGES.icon).copy(big)
    await fileInput(page).setInputFiles({ buffer: big, mimeType: 'image/png', name: 'huge.png' })
    await expect(picker(page).getByRole('alert')).toHaveText('This image is too large. The maximum is 10 MB.')

    expect(mediaRequests).toBe(0)
    expect(uploads).toHaveLength(0)
    await expect(page.getByTestId('note-cover')).toHaveCount(0)
  })

  test('if the note cannot be updated: the old header comes back, an error shows, the uploaded file is removed', async ({ page }) => {
    const note = await seed.note(`E2E header fail ${RUN}`)
    const uploads = trackUploads(page)
    const deleted: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'DELETE') deleted.push(new URL(request.url()).pathname)
    })
    await openNote(page, note)
    await page.route('**/api/notes/*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ body: JSON.stringify({ errors: [{ message: 'Something went wrong.' }] }), contentType: 'application/json', status: 500 })
        : route.fallback(),
    )
    await header(page).hover()
    await page.getByTestId('add-cover').click()
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.cover)

    await expect(picker(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 20000 })
    await expect(page.getByTestId('note-cover')).toHaveCount(0)
    expect(uploads).toHaveLength(1)
    await expect.poll(() => deleted).toContain(`/api/media/${uploads[0].id}`)
    await expect.poll(async () => (await page.request.get(`${BASE}/api/media/${uploads[0].id}`)).status()).toBe(404)
    expect((await storedNote(page, note.id)).cover ?? null).toBeNull()

    // Works again once the server is fine
    await page.unroute('**/api/notes/*')
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.cover)
    await expect(picker(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.getByTestId('note-cover')).toBeVisible()
  })

  test('Escape closes the picker and gives focus back to the button; a click outside closes it too', async ({ page }) => {
    const note = await seed.note(`E2E header keyboard ${RUN}`)
    await openNote(page, note)
    await header(page).hover()
    await page.getByTestId('add-icon').click()
    await expect(picker(page)).toBeVisible()
    await expect(picker(page).getByRole('button', { name: 'Upload file' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(picker(page)).toHaveCount(0)
    await expect(page.getByTestId('add-icon')).toBeFocused()

    await page.getByTestId('add-icon').click()
    await expect(picker(page)).toBeVisible()
    await editable(page).click()
    await expect(picker(page)).toHaveCount(0)
  })

  test('typing and changing the cover at the same time: both are saved (requests never overlap)', async ({ page }) => {
    const note = await seed.note(`E2E header race ${RUN}`)
    trackUploads(page)
    let inFlight = 0
    let maxInFlight = 0
    const isNotePatch = (url: string, method: string) => method === 'PATCH' && url.includes('/api/notes/')
    page.on('request', (request) => {
      if (isNotePatch(request.url(), request.method())) maxInFlight = Math.max(maxInFlight, ++inFlight)
    })
    // A request is over for the page once its response arrives (that is when `fetch` resolves and the queue moves on)
    page.on('response', (response) => {
      if (isNotePatch(response.url(), response.request().method())) inFlight--
    })
    page.on('requestfailed', (request) => {
      if (isNotePatch(request.url(), request.method())) inFlight--
    })
    await openNote(page, note)
    // Slow content saves down, so the cover update would overlap one if it were not queued behind it
    await page.route('**/api/notes/*', async (route) => {
      const request = route.request()
      if (request.method() === 'PATCH' && (request.postData() ?? '').startsWith('{"note"')) {
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      await route.fallback()
    })

    await editable(page).locator('p').last().click()
    await page.keyboard.press('End')
    await page.keyboard.type(` typed-with-cover-${RUN}`)
    await expect(page.getByTestId('note-save-status')).toHaveAttribute('data-state', 'saving', { timeout: 10000 })
    await header(page).hover()
    await page.getByTestId('add-cover').click()
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.cover)
    await expect(picker(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.getByTestId('note-save-status')).toHaveAttribute('data-state', 'saved', { timeout: 20000 })

    expect(maxInFlight).toBe(1)
    const saved = await storedNote(page, note.id)
    expect(saved.cover).toBeTruthy()
    expect(JSON.stringify(saved.note)).toContain(`typed-with-cover-${RUN}`)
  })

  test('phone (touch): the add buttons are visible without hover; the picker fits the screen', async ({ browser }) => {
    const note = await seed.note(`E2E header phone ${RUN}`)
    const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } })
    const page = await context.newPage()
    await openNote(page, note)
    await expect(page.getByTestId('note-header-add')).toHaveCSS('opacity', '1')
    await page.getByTestId('add-cover').tap()
    await expect(picker(page)).toBeVisible()
    const box = (await picker(page).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await context.close()
  })
})
