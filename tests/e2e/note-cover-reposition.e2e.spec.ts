import { expect, type Page, test } from '@playwright/test'

import type { Media, Note } from '../../src/payload-types.js'
import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'
import { createNoteSeeder, FIXTURE_IMAGES } from '../helpers/seedNotes'

/*
 * Cover "Reposition" on the note page (src/views/note-header/EditableNoteHeader.tsx + cover-position.ts).
 * Logged in as a `user`-role member, desktop size. Every test uses its own note.
 */

const BASE = 'http://localhost:3000'
const RUN = Date.now().toString(36)
const seed = createNoteSeeder()
const member: TestAccount = { password: 'e2e-pass-1234', role: 'user', username: `e2e-reposition-${RUN}` }

let cover: Media

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { height: 800, width: 1280 } })

test.beforeAll(async () => {
  await seedAccount(member)
  cover = await seed.media(FIXTURE_IMAGES.cover, `E2E reposition cover ${RUN}`)
})

test.afterAll(async () => {
  await seed.cleanup()
  await deleteAccount(member.username)
})

const coverBox = (page: Page) => page.getByTestId('note-cover')
const objectPosition = (page: Page) =>
  page.locator('[data-testid="note-cover"] img').evaluate((img) => getComputedStyle(img).objectPosition)
const storedPosition = async (page: Page, id: number) =>
  ((await (await page.request.get(`${BASE}/api/notes/${id}?depth=0`)).json()) as Note).coverPosition

const openNote = async (page: Page, note: Note) => {
  await loginAs(page, member)
  await page.goto(`${BASE}/${note.slug}`)
  await expect(page.locator('.note-page--editor [contenteditable="true"]')).toBeVisible({ timeout: 60000 })
  await expect.poll(() => page.locator('[data-testid="note-cover"] img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
}

const startReposition = async (page: Page) => {
  await coverBox(page).hover()
  await page.getByTestId('reposition-cover').click()
  await expect(coverBox(page)).toHaveAttribute('role', 'slider')
  await expect(page.getByText('Drag image to reposition')).toBeVisible()
}

/** Drags the cover image vertically by `deltaY` pixels (negative = up). */
const dragCover = async (page: Page, deltaY: number) => {
  const box = (await coverBox(page).boundingBox())!
  const x = box.x + box.width / 3
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + deltaY, { steps: 10 })
  await page.mouse.up()
}

test.describe('Cover reposition', () => {
  test('drag up → Save: the new position is stored, used after reload and seen by guests', async ({ browser, page }) => {
    const note = await seed.note(`E2E reposition drag ${RUN}`, { cover: cover.id })
    await openNote(page, note)
    expect(await objectPosition(page)).toBe('50% 50%')
    await startReposition(page)

    // 1200×600 image in a 1280px wide, 240px high cover (30vh of 800): scaled to 640px high, 400px hidden;
    // dragging up 80px moves it 20%
    await dragCover(page, -80)
    const now = Number(await coverBox(page).getAttribute('aria-valuenow'))
    expect(now).toBeGreaterThan(65)
    expect(now).toBeLessThan(75)

    await page.getByTestId('save-position').click()
    await expect(page.getByTestId('save-position')).toHaveCount(0)
    const stored = await storedPosition(page, note.id)
    expect(stored).toBeGreaterThan(65)
    expect(stored).toBeLessThan(75)
    // Back to the normal cover, focus back on "Reposition"
    await expect(coverBox(page)).not.toHaveAttribute('role', 'slider')
    await expect(page.getByTestId('reposition-cover')).toBeFocused()

    await page.reload()
    await expect.poll(() => objectPosition(page)).toBe(`50% ${stored}%`)
    const guestContext = await browser.newContext({ viewport: { height: 800, width: 1280 } })
    const guest = await guestContext.newPage()
    await guest.goto(`${BASE}/${note.slug}`)
    expect(await guest.locator('[data-testid="note-cover"] img').evaluate((img) => getComputedStyle(img).objectPosition)).toBe(
      `50% ${stored}%`,
    )
    await guestContext.close()
  })

  test('Cancel (or Escape) puts the cover back and saves nothing', async ({ page }) => {
    const note = await seed.note(`E2E reposition cancel ${RUN}`, { cover: cover.id, coverPosition: 30 })
    let patches = 0
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && (request.postData() ?? '').includes('coverPosition')) patches++
    })
    await openNote(page, note)
    await startReposition(page)
    await dragCover(page, 60)
    expect(await objectPosition(page)).not.toBe('50% 30%')
    await page.getByTestId('cancel-position').click()
    expect(await objectPosition(page)).toBe('50% 30%')

    await startReposition(page)
    await dragCover(page, -60)
    await page.keyboard.press('Escape')
    await expect(coverBox(page)).not.toHaveAttribute('role', 'slider')
    expect(await objectPosition(page)).toBe('50% 30%')
    expect(patches).toBe(0)
    expect(await storedPosition(page, note.id)).toBe(30)
  })

  test('keyboard: the cover is a slider; arrows move it, Enter saves', async ({ page }) => {
    const note = await seed.note(`E2E reposition keys ${RUN}`, { cover: cover.id })
    await openNote(page, note)
    await startReposition(page)
    await expect(coverBox(page)).toBeFocused()
    await expect(coverBox(page)).toHaveAttribute('aria-valuenow', '50')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Shift+ArrowUp')
    await expect(coverBox(page)).toHaveAttribute('aria-valuenow', '61')
    await expect(coverBox(page)).toHaveAttribute('aria-valuetext', '61% from the top')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('save-position')).toHaveCount(0)
    expect(await storedPosition(page, note.id)).toBe(61)
  })

  test('saving fails: an error shows, the mode stays open, Cancel goes back to the stored position', async ({ page }) => {
    const note = await seed.note(`E2E reposition fail ${RUN}`, { cover: cover.id })
    await openNote(page, note)
    await page.route('**/api/notes/*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ body: JSON.stringify({ errors: [{ message: 'Something went wrong.' }] }), contentType: 'application/json', status: 500 })
        : route.fallback(),
    )
    await startReposition(page)
    await dragCover(page, -40)
    await page.getByTestId('save-position').click()
    await expect(coverBox(page).getByRole('alert')).toHaveText('Something went wrong.')
    await expect(coverBox(page)).toHaveAttribute('role', 'slider')
    await page.getByTestId('cancel-position').click()
    expect(await objectPosition(page)).toBe('50% 50%')
    expect(await storedPosition(page, note.id)).toBe(50)
  })

  test('the drawer and "Change cover" are not offered while repositioning', async ({ page }) => {
    const note = await seed.note(`E2E reposition modes ${RUN}`, { cover: cover.id })
    await openNote(page, note)
    await startReposition(page)
    await expect(page.getByTestId('change-cover')).toHaveCount(0)
    await expect(page.getByTestId('reposition-cover')).toHaveCount(0)
    await expect(page.getByTestId('note-image-drawer')).toHaveCount(0)
  })
})
