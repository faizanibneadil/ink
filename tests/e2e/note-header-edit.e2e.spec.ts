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
// The image drawer (src/views/note-header/ImageDrawer.tsx, Payload's Drawer)
const drawer = (page: Page) => page.getByTestId('note-image-drawer')
const drawerTitle = (page: Page) => page.locator('.note-image-drawer .drawer__header__title')
const fileInput = (page: Page) => drawer(page).locator('input[type="file"]')
const dropzone = (page: Page) => drawer(page).locator('.dropzone')

/** Drops a file on the drawer's Payload Dropzone, the way a browser does (a `drop` event with the file). */
const dropFile = async (page: Page, file: { buffer: Buffer; mimeType: string; name: string }) => {
  const dataTransfer = await page.evaluateHandle(({ base64, mimeType, name }) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], name, { type: mimeType }))
    return transfer
  }, { base64: file.buffer.toString('base64'), mimeType: file.mimeType, name: file.name })
  await dropzone(page).dispatchEvent('dragenter', { dataTransfer })
  await dropzone(page).dispatchEvent('dragover', { dataTransfer })
  await dropzone(page).dispatchEvent('drop', { dataTransfer })
}
const png = (path: string, name: string) => ({ buffer: fs.readFileSync(path), mimeType: 'image/png', name })
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
    await expect(drawer(page)).toBeVisible()
    await expect(drawerTitle(page)).toHaveText('Change cover')
    await expect(drawer(page).getByRole('button', { name: 'Select a file' })).toBeVisible()
    await expect(drawer(page).getByRole('heading', { name: 'Uploaded images' })).toBeVisible()
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.cover)
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.locator('[data-testid="note-cover"] img')).toHaveAttribute('src', /\/api\/media\/file\//)

    await header(page).hover()
    await page.getByTestId('add-icon').click()
    await expect(drawerTitle(page)).toHaveText('Change icon')
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.icon)
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.locator('[data-testid="note-icon"] img')).toHaveAttribute('src', /\/api\/media\/file\//)
    // "Add icon" is gone: focus moves to the new icon (not to the top of the page)
    await expect(page.getByTestId('note-icon')).toBeFocused()
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
    await expect(drawerTitle(page)).toHaveText('Change cover')
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.icon)
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.locator('[data-testid="note-cover"] img')).toHaveAttribute('src', uploads[0].url as string)

    await page.getByTestId('note-icon').click()
    await expect(drawerTitle(page)).toHaveText('Change icon')
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.cover)
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })
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
    // Refused in the drawer: the header never even shows a preview of the file (no image ever appears in it)
    await header(page).evaluate((element) => {
      ;(window as unknown as { headerImages: number }).headerImages = 0
      new MutationObserver(() => {
        if (element.querySelector('img')) (window as unknown as { headerImages: number }).headerImages++
      }).observe(element, { childList: true, subtree: true })
    })
    await header(page).hover()
    await page.getByTestId('add-cover').click()

    await fileInput(page).setInputFiles({ buffer: Buffer.from('not an image'), mimeType: 'text/plain', name: 'notes.txt' })
    await expect(drawer(page).getByRole('alert')).toHaveText('Choose an image file (PNG, JPEG, GIF, WebP or AVIF).')

    await fileInput(page).setInputFiles({
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      mimeType: 'image/svg+xml',
      name: 'icon.svg',
    })
    await expect(drawer(page).getByRole('alert')).toHaveText('Choose an image file (PNG, JPEG, GIF, WebP or AVIF).')

    const big = Buffer.alloc(10 * 1024 * 1024 + 1)
    fs.readFileSync(FIXTURE_IMAGES.icon).copy(big)
    await fileInput(page).setInputFiles({ buffer: big, mimeType: 'image/png', name: 'huge.png' })
    await expect(drawer(page).getByRole('alert')).toHaveText('This image is too large. The maximum is 10 MB.')

    expect(mediaRequests).toBe(0)
    expect(uploads).toHaveLength(0)
    await expect(page.getByTestId('note-cover')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { headerImages: number }).headerImages)).toBe(0)
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

    await expect(drawer(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 20000 })
    await expect(page.getByTestId('note-cover')).toHaveCount(0)
    expect(uploads).toHaveLength(1)
    await expect.poll(() => deleted).toContain(`/api/media/${uploads[0].id}`)
    await expect.poll(async () => (await page.request.get(`${BASE}/api/media/${uploads[0].id}`)).status()).toBe(404)
    expect((await storedNote(page, note.id)).cover ?? null).toBeNull()

    // Closed and opened again: starts clean, without the old error
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toHaveCount(0)
    await header(page).hover()
    await page.getByTestId('add-cover').click()
    await expect(drawer(page)).toBeVisible()
    await expect(drawer(page).getByRole('alert')).toHaveCount(0)

    // Works again once the server is fine
    await page.unroute('**/api/notes/*')
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.cover)
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.getByTestId('note-cover')).toBeVisible()
  })

  test('Escape, the close button and a click beside the drawer close it; focus goes back to the button', async ({ page }) => {
    const note = await seed.note(`E2E header keyboard ${RUN}`)
    await openNote(page, note)
    await header(page).hover()
    await page.getByTestId('add-icon').click()
    await expect(drawer(page)).toBeVisible()
    // Payload's drawer: its title is focused and names the dialog
    await expect(drawerTitle(page)).toBeFocused()
    await expect(page.getByRole('dialog', { name: 'Change icon' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toHaveCount(0)
    await expect(page.getByTestId('add-icon')).toBeFocused()

    await page.getByTestId('add-icon').click()
    await page.locator('.note-image-drawer .drawer__header__close').click()
    await expect(drawer(page)).toHaveCount(0)
    await expect(page.getByTestId('add-icon')).toBeFocused()

    await page.getByTestId('add-icon').click()
    await expect(drawer(page)).toBeVisible()
    await page.mouse.click(40, 400)
    await expect(drawer(page)).toHaveCount(0)
    // Nothing changed
    await expect(page.getByTestId('note-icon')).toHaveCount(0)
  })

  test('keyboard only: Tab moves inside the drawer (focus stays in it) and "Select a file" opens the file chooser', async ({ page }) => {
    const note = await seed.note(`E2E header tab ${RUN}`)
    const uploads = trackUploads(page)
    // Listen from the start: Playwright turns on file chooser interception asynchronously, so a listener added just
    // before the key press can miss a chooser that opens right away
    const chooser = page.waitForEvent('filechooser', { timeout: 60000 })
    await openNote(page, note)
    await header(page).hover()
    await page.getByTestId('add-cover').focus()
    await page.keyboard.press('Enter')
    await expect(drawerTitle(page)).toBeFocused()
    const select = drawer(page).getByRole('button', { name: 'Select a file' })
    for (let step = 0; step < 6 && !(await select.evaluate((element) => element === document.activeElement)); step++) {
      await page.keyboard.press('Tab')
    }
    await expect(select).toBeFocused()
    // Focus is trapped: many Tabs never leave the drawer
    for (let step = 0; step < 12; step++) await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.note-image-drawer')))).toBe(true)

    await select.focus()
    await page.keyboard.press('Enter')
    await (await chooser).setFiles(FIXTURE_IMAGES.cover)
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.getByTestId('note-cover')).toBeVisible()
    expect(uploads).toHaveLength(1)
    // "Add cover" is gone: focus lands on "Change cover"
    await expect(page.getByTestId('change-cover')).toBeFocused()
  })

  test('drop an image on the dropzone, or paste one: uploaded and set; a dropped text file is refused', async ({ page }) => {
    const note = await seed.note(`E2E header drop ${RUN}`)
    const uploads = trackUploads(page)
    await openNote(page, note)
    await header(page).hover()
    await page.getByTestId('add-cover').click()

    await dropFile(page, { buffer: Buffer.from('plain text'), mimeType: 'text/plain', name: 'notes.txt' })
    await expect(drawer(page).getByRole('alert')).toHaveText('Choose an image file (PNG, JPEG, GIF, WebP or AVIF).')
    await expect(dropzone(page)).toHaveClass(/dropzone--has-error/)
    expect(uploads).toHaveLength(0)

    await dropFile(page, png(FIXTURE_IMAGES.cover, 'dropped-cover.png'))
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.locator('[data-testid="note-cover"] img')).toHaveAttribute('src', /dropped-cover/)

    await header(page).hover()
    await page.getByTestId('add-icon').click()
    await dropzone(page).focus()
    await dropzone(page).evaluate((element, base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], 'pasted-icon.png', { type: 'image/png' }))
      element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }))
    }, fs.readFileSync(FIXTURE_IMAGES.icon).toString('base64'))
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.locator('[data-testid="note-icon"] img')).toHaveAttribute('src', /pasted-icon/)

    expect(uploads.map((upload) => upload.filename)).toEqual([
      expect.stringMatching(/^dropped-cover/),
      expect.stringMatching(/^pasted-icon/),
    ])
    const saved = await storedNote(page, note.id)
    expect((saved.cover as Media).id).toBe(uploads[0].id)
    expect((saved.icon as Media).id).toBe(uploads[1].id)
  })

  test('closing the drawer during an upload: the upload finishes; if it fails, the drawer opens again with the error', async ({ page }) => {
    const note = await seed.note(`E2E header close busy ${RUN}`)
    trackUploads(page)
    await openNote(page, note)
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/api/media', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      await held
      await route.fulfill({ body: JSON.stringify({ errors: [{ message: 'Upload failed on the server.' }] }), contentType: 'application/json', status: 500 })
    })
    await header(page).hover()
    await page.getByTestId('add-cover').click()
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.cover)
    await expect(drawer(page).getByRole('button', { name: 'Uploading…' })).toBeDisabled()
    // The preview shows at once
    await expect(page.locator('[data-testid="note-cover"] img')).toHaveAttribute('src', /^blob:/)
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toHaveCount(0)

    release()
    await expect(drawer(page).getByRole('alert')).toHaveText('Upload failed on the server.', { timeout: 20000 })
    await expect(page.getByTestId('note-cover')).toHaveCount(0)
    await page.unroute('**/api/media')

    // Closed during an upload that works: the cover is set, the drawer stays closed
    await fileInput(page).setInputFiles(FIXTURE_IMAGES.cover)
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="note-cover"] img')).toHaveAttribute('src', /\/api\/media\/file\//, { timeout: 20000 })
    await expect(drawer(page)).toHaveCount(0)
    expect((await storedNote(page, note.id)).cover).toBeTruthy()
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
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.getByTestId('note-save-status')).toHaveAttribute('data-state', 'saved', { timeout: 20000 })

    expect(maxInFlight).toBe(1)
    const saved = await storedNote(page, note.id)
    expect(saved.cover).toBeTruthy()
    expect(JSON.stringify(saved.note)).toContain(`typed-with-cover-${RUN}`)
  })

  test('phone (touch): the add buttons are visible without hover; the drawer takes the whole screen', async ({ browser }) => {
    const note = await seed.note(`E2E header phone ${RUN}`)
    const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } })
    const page = await context.newPage()
    await openNote(page, note)
    await expect(page.getByTestId('note-header-add')).toHaveCSS('opacity', '1')
    await page.getByTestId('add-cover').tap()
    await expect(drawer(page)).toBeVisible()
    const box = (await page.locator('.note-image-drawer .drawer__content').boundingBox())!
    expect(box).toEqual({ height: 844, width: 390, x: 0, y: 0 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await page.locator('.note-image-drawer .drawer__header__close').tap()
    await expect(drawer(page)).toHaveCount(0)
    await context.close()
  })

  test('tablet / desktop: Payload\'s drawer width on the right, the note still visible beside it', async ({ page }) => {
    const note = await seed.note(`E2E header desktop drawer ${RUN}`)
    await openNote(page, note)
    for (const [width, expected] of [[768, 600], [1280, 600], [1920, 768]] as const) {
      await page.setViewportSize({ height: 900, width })
      await header(page).hover()
      await page.getByTestId('add-cover').click()
      const box = (await page.locator('.note-image-drawer .drawer__content').boundingBox())!
      expect(Math.round(box.width)).toBe(expected)
      expect(Math.round(box.x + box.width)).toBe(width)
      await page.keyboard.press('Escape')
      await expect(drawer(page)).toHaveCount(0)
    }
  })
})
