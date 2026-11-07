import { expect, type Page, test } from '@playwright/test'

import type { Media, Note } from '../../src/payload-types.js'
import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'
import { createNoteSeeder, FIXTURE_IMAGES } from '../helpers/seedNotes'

/*
 * The picker's "Media library" tab (src/views/note-header/MediaLibrary.tsx): choose an image uploaded before as the
 * cover / icon. Logged in as a `user`-role member.
 */

const BASE = 'http://localhost:3000'
const RUN = Date.now().toString(36)
const seed = createNoteSeeder()
const member: TestAccount = { password: 'e2e-pass-1234', role: 'user', username: `e2e-library-${RUN}` }
/** Same page size as LIBRARY_PAGE_SIZE in src/views/note-header/header-images.ts */
const PAGE_SIZE = 24

let images: Media[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await seedAccount(member)
  // One more than a page, oldest first: images[0] is only on page 2
  images = []
  for (let i = 0; i <= PAGE_SIZE; i++) {
    images.push(await seed.media(i % 2 ? FIXTURE_IMAGES.icon : FIXTURE_IMAGES.cover, `E2E library ${RUN} #${i}`))
  }
})

test.afterAll(async () => {
  await seed.cleanup()
  await deleteAccount(member.username)
})

// "Uploaded images" in the image drawer (src/views/note-header/ImageDrawer.tsx)
const drawer = (page: Page) => page.getByTestId('note-image-drawer')
const grid = (page: Page) => page.getByTestId('media-library-grid')
const item = (page: Page, media: Media) => grid(page).locator(`[data-media-id="${media.id}"]`)

const openLibrary = async (page: Page, note: Note, trigger: 'add-cover' | 'add-icon' = 'add-cover') => {
  await loginAs(page, member)
  await page.goto(`${BASE}/${note.slug}`)
  await expect(page.locator('.note-page--editor [contenteditable="true"]')).toBeVisible({ timeout: 60000 })
  await page.getByTestId('note-header').hover()
  await page.getByTestId(trigger).click()
  // The library is right below the dropzone: no tab to switch to
  await expect(drawer(page).getByRole('heading', { name: 'Uploaded images' })).toBeVisible()
}

const storedNote = async (page: Page, id: number) =>
  (await (await page.request.get(`${BASE}/api/notes/${id}?depth=0`)).json()) as Note

test.describe('Uploaded images in the drawer', () => {
  test('pick an image as the cover and another as the icon: no new upload, saved, seen after reload', async ({ page }) => {
    const note = await seed.note(`E2E library pick ${RUN}`)
    let uploads = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/media') uploads++
    })
    const newest = images[images.length - 1]
    const second = images[images.length - 2]

    await openLibrary(page, note)
    await expect(item(page, newest)).toBeVisible()
    await expect(item(page, newest)).toHaveAccessibleName(`E2E library ${RUN} #${PAGE_SIZE}`)
    await item(page, newest).click()
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.locator('[data-testid="note-cover"] img')).toHaveAttribute('src', newest.url as string)

    await page.getByTestId('note-header').hover()
    await page.getByTestId('add-icon').click()
    await item(page, second).click()
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })

    expect(uploads).toBe(0)
    const saved = await storedNote(page, note.id)
    expect(saved.cover).toBe(newest.id)
    expect(saved.icon).toBe(second.id)
    await page.reload()
    await expect(page.locator('[data-testid="note-icon"] img')).toHaveAttribute('src', second.url as string)
  })

  test('only images are offered (older SVG / other files are not), newest first, one page at a time', async ({ page }) => {
    // Media accepts images only now; an SVG / text file can only be an older row, from before that
    const svg = await seed.legacyMedia('image/svg+xml', `E2E svg ${RUN}`)
    const text = await seed.legacyMedia('text/plain', `E2E text ${RUN}`)
    const note = await seed.note(`E2E library filter ${RUN}`)
    await openLibrary(page, note)
    await expect(grid(page)).toBeVisible()
    await expect(grid(page).locator('.note-media-library__item')).toHaveCount(PAGE_SIZE)
    await expect(item(page, svg)).toHaveCount(0)
    await expect(item(page, text)).toHaveCount(0)

    // Newest first: the newest seeded image is on page 1, the oldest one only after "Load more"
    await expect(item(page, images[images.length - 1])).toBeVisible()
    await expect(item(page, images[0])).toHaveCount(0)
    await drawer(page).getByRole('button', { name: 'Load more' }).click()
    await expect(item(page, images[0])).toBeVisible()
    await expect(item(page, svg)).toHaveCount(0)
    await expect(item(page, text)).toHaveCount(0)
  })

  test('empty library: a clear message', async ({ page }) => {
    const note = await seed.note(`E2E library empty ${RUN}`)
    await page.route('**/api/media?*', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ body: JSON.stringify({ docs: [], hasNextPage: false, page: 1 }), contentType: 'application/json' })
        : route.fallback(),
    )
    await openLibrary(page, note)
    await expect(page.getByTestId('media-library-empty')).toHaveText('No images yet. Upload one above.')
  })

  test('loading fails: an error with "Try again", which works once the server is fine', async ({ page }) => {
    const note = await seed.note(`E2E library error ${RUN}`)
    await page.route('**/api/media?*', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ body: JSON.stringify({ errors: [{ message: 'Something went wrong.' }] }), contentType: 'application/json', status: 500 })
        : route.fallback(),
    )
    await openLibrary(page, note)
    await expect(page.getByTestId('media-library-error')).toContainText('Something went wrong.')
    await page.unroute('**/api/media?*')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(grid(page)).toBeVisible()
  })

  test('the note cannot be updated: the old header comes back, an error shows, the chosen image is kept in Media', async ({ page }) => {
    const note = await seed.note(`E2E library fail ${RUN}`)
    const chosen = images[images.length - 3]
    await openLibrary(page, note)
    await page.route('**/api/notes/*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ body: JSON.stringify({ errors: [{ message: 'Something went wrong.' }] }), contentType: 'application/json', status: 500 })
        : route.fallback(),
    )
    await item(page, chosen).click()
    await expect(drawer(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 20000 })
    await expect(page.getByTestId('note-cover')).toHaveCount(0)
    // Not deleted: it is an existing file of the library, not one this page uploaded
    expect((await page.request.get(`${BASE}/api/media/${chosen.id}`)).status()).toBe(200)
    expect((await storedNote(page, note.id)).cover ?? null).toBeNull()
  })

  test('keyboard: pick an image with Tab + Enter; the drawer closes and focus goes back', async ({ page }) => {
    const note = await seed.note(`E2E library keyboard ${RUN}`)
    const newest = images[images.length - 1]
    await openLibrary(page, note, 'add-icon')
    await expect(item(page, newest)).toBeVisible()
    for (let step = 0; step < 8 && !(await item(page, newest).evaluate((element) => element === document.activeElement)); step++) {
      await page.keyboard.press('Tab')
    }
    await expect(item(page, newest)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })
    await expect(page.locator('[data-testid="note-icon"] img')).toHaveAttribute('src', newest.url as string)
    await expect(page.getByTestId('note-icon')).toBeFocused()
  })

  test('an image uploaded in the drawer is first in the list the next time it opens', async ({ page }) => {
    const note = await seed.note(`E2E library refresh ${RUN}`)
    page.on('response', async (response) => {
      if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/media' && response.ok()) {
        seed.adopt('media', ((await response.json()) as { doc: Media }).doc.id)
      }
    })
    await openLibrary(page, note)
    await expect(grid(page)).toBeVisible()
    const upload = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/media')
    await drawer(page).locator('input[type="file"]').setInputFiles(FIXTURE_IMAGES.icon)
    const uploaded = ((await (await upload).json()) as { doc: Media }).doc
    await expect(drawer(page)).toHaveCount(0, { timeout: 20000 })

    await page.getByTestId('note-header').hover()
    await page.getByTestId('add-icon').click()
    await expect(grid(page).locator('.note-media-library__item').first()).toHaveAttribute('data-media-id', String(uploaded.id))
  })
})
