import { expect, type Page, test } from '@playwright/test'

import type { Media, Note } from '../../src/payload-types.js'
import { createNoteSeeder, FIXTURE_IMAGES } from '../helpers/seedNotes'

/*
 * Note page `/<slug>` for guests: Notion-style header (cover photo + rounded-square icon).
 * Notes and images are created through the local API (same database as the dev server) and removed afterwards.
 */

const BASE = 'http://localhost:3000'
const RUN = Date.now().toString(36)
const seed = createNoteSeeder()

let cover: Media
let icon: Media
let both: Note
let iconOnly: Note
let coverOnly: Note
let plain: Note

test.beforeAll(async () => {
  cover = await seed.media(FIXTURE_IMAGES.cover, `E2E cover ${RUN}`)
  icon = await seed.media(FIXTURE_IMAGES.icon, `E2E icon ${RUN}`)
  both = await seed.note(`E2E header both ${RUN}`, { cover: cover.id, coverPosition: 30, icon: icon.id })
  iconOnly = await seed.note(`E2E header icon only ${RUN}`, { icon: icon.id })
  coverOnly = await seed.note(`E2E header cover only ${RUN}`, { cover: cover.id })
  plain = await seed.note(`E2E header none ${RUN}`)
})

test.afterAll(async () => {
  await seed.cleanup()
})

/** Collects page errors and failed (5xx) responses while a test runs. */
const watchProblems = (page: Page) => {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`)
  })
  return problems
}

const open = async (page: Page, note: Note) => {
  const response = await page.goto(`${BASE}/${note.slug}`)
  expect(response?.status()).toBe(200)
  await expect(page.locator('.note-view')).toBeVisible()
}

/** True once the image has loaded and has pixels (not a broken image). */
const isLoaded = (page: Page, selector: string) =>
  page.locator(selector).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)

test.describe('Note page header (guest)', () => {
  test('cover + icon: both images load, icon overlaps the cover, position is applied', async ({ page }) => {
    const problems = watchProblems(page)
    await open(page, both)

    const header = page.getByTestId('note-header')
    await expect(header).toBeVisible()
    const coverImage = page.locator('[data-testid="note-cover"] img')
    const iconImage = page.locator('[data-testid="note-icon"] img')
    await expect(coverImage).toHaveAttribute('src', cover.url as string)
    await expect(iconImage).toHaveAttribute('src', icon.url as string)
    await expect(iconImage).toHaveAttribute('alt', `E2E icon ${RUN}`)
    await expect.poll(() => isLoaded(page, '[data-testid="note-cover"] img')).toBe(true)
    await expect.poll(() => isLoaded(page, '[data-testid="note-icon"] img')).toBe(true)

    // coverPosition 30 -> `object-position: center 30%`
    expect(await coverImage.evaluate((img) => getComputedStyle(img).objectPosition)).toBe('50% 30%')

    // Notion layout: the icon sits on the bottom edge of the cover
    const coverBox = (await page.getByTestId('note-cover').boundingBox())!
    const iconBox = (await page.getByTestId('note-icon').boundingBox())!
    expect(iconBox.y).toBeLessThan(coverBox.y + coverBox.height)
    expect(iconBox.y + iconBox.height).toBeGreaterThan(coverBox.y + coverBox.height)
    // The cover spans the whole page width
    expect(coverBox.width).toBe(page.viewportSize()!.width)

    // Read-only: no edit controls in the header
    await expect(header.locator('button, input, [contenteditable="true"]')).toHaveCount(0)
    // And the note text is still there, below the header
    await expect(page.locator('.note-view')).toContainText(`E2E header both ${RUN}`)
    const textBox = (await page.locator('.note-view').boundingBox())!
    expect(textBox.y).toBeGreaterThan(iconBox.y + iconBox.height)

    expect(problems).toEqual([])
  })

  for (const viewport of [
    { align: 'center', height: 844, name: 'phone', width: 390 },
    { align: 'left', height: 1024, name: 'tablet', width: 768 },
    { align: 'left', height: 900, name: 'desktop', width: 1280 },
  ] as const) {
    test(`icon is ${viewport.align === 'center' ? 'centred' : 'left-aligned with the text'} on ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ height: viewport.height, width: viewport.width })
      await open(page, both)
      const iconBox = (await page.getByTestId('note-icon').boundingBox())!
      const textBox = (await page.locator('.note-view').boundingBox())!
      if (viewport.align === 'center') {
        expect(Math.abs(iconBox.x + iconBox.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1)
      } else {
        expect(Math.abs(iconBox.x - textBox.x)).toBeLessThanOrEqual(1)
      }
      // Smaller icon on phones, like Notion
      expect(iconBox.width).toBe(viewport.width < 768 ? 76 : 104)
      expect(iconBox.height).toBe(iconBox.width)
      // Rounded square, not a circle
      const radius = await page.getByTestId('note-icon').evaluate((el) => parseFloat(getComputedStyle(el).borderRadius))
      expect(radius).toBeGreaterThan(0)
      expect(radius).toBeLessThan(iconBox.width / 2)
      // No horizontal scrolling
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    })
  }

  test('icon only: no cover, icon above the text with space on top', async ({ page }) => {
    await open(page, iconOnly)
    await expect(page.getByTestId('note-cover')).toHaveCount(0)
    await expect(page.getByTestId('note-icon')).toBeVisible()
    await expect.poll(() => isLoaded(page, '[data-testid="note-icon"] img')).toBe(true)
    const iconBox = (await page.getByTestId('note-icon').boundingBox())!
    expect(iconBox.y).toBeGreaterThanOrEqual(32)
    const textBox = (await page.locator('.note-view').boundingBox())!
    expect(textBox.y).toBeGreaterThan(iconBox.y + iconBox.height)
  })

  test('cover only: cover without an icon', async ({ page }) => {
    await open(page, coverOnly)
    await expect(page.getByTestId('note-cover')).toBeVisible()
    await expect(page.getByTestId('note-icon')).toHaveCount(0)
    // Default position: middle
    expect(
      await page.locator('[data-testid="note-cover"] img').evaluate((img) => getComputedStyle(img).objectPosition),
    ).toBe('50% 50%')
  })

  test('no cover and no icon: no header at all', async ({ page }) => {
    await open(page, plain)
    await expect(page.getByTestId('note-header')).toHaveCount(0)
    await expect(page.locator('.note-view')).toContainText(`E2E header none ${RUN}`)
  })
})
