import { type Browser, expect, type Page, test } from '@playwright/test'

import type { Media, Note } from '../../src/payload-types.js'
import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'
import { createNoteSeeder, FIXTURE_IMAGES } from '../helpers/seedNotes'

/*
 * Note page `/<slug>` for logged-in users: the Notion-style editor (Lexical `notion` view, src/views/config.tsx).
 * The Payload admin must keep its own editor (`default` view).
 */

const BASE = 'http://localhost:3000'
const RUN = Date.now().toString(36)
const seed = createNoteSeeder()
const member: TestAccount = { password: 'e2e-pass-1234', role: 'user', username: `e2e-member-${RUN}` }
const admin: TestAccount = { password: 'e2e-pass-1234', role: 'admin', username: `e2e-admin-${RUN}` }

let cover: Media
let icon: Media
let note: Note
let empty: Note

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await seedAccount(member)
  await seedAccount(admin)
  cover = await seed.media(FIXTURE_IMAGES.cover, `E2E editor cover ${RUN}`)
  icon = await seed.media(FIXTURE_IMAGES.icon, `E2E editor icon ${RUN}`)
  note = await seed.note(`E2E editor ${RUN}`, { cover: cover.id, icon: icon.id, text: 'Second line of the note' })
  empty = await seed.note('', { empty: true })
})

test.afterAll(async () => {
  await seed.cleanup()
  await deleteAccount(member.username)
  await deleteAccount(admin.username)
})

const watchProblems = (page: Page) => {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`)
  })
  return problems
}

const editable = (page: Page) => page.locator('.note-page--editor [contenteditable="true"]')

/** Logged-in page on `/<slug>` with the editor ready. */
const openEditor = async (page: Page, target: Note, account: TestAccount = member) => {
  await loginAs(page, account)
  const response = await page.goto(`${BASE}/${target.slug}`)
  expect(response?.status()).toBe(200)
  await expect(editable(page)).toBeVisible({ timeout: 60000 })
}

const guestPage = async (browser: Browser, viewport: { height: number; width: number }) => {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(`${BASE}/${note.slug}`)
  await expect(page.locator('.note-view')).toBeVisible()
  return { context, page }
}

test.describe('Note page editor (logged in)', () => {
  test('opens in the notion view: no fixed toolbar, no view selector, no field label', async ({ page }) => {
    const problems = watchProblems(page)
    await openEditor(page, note)
    await expect(page.locator('.note-page--editor [data-lexical-view]')).toHaveAttribute('data-lexical-view', 'notion')
    await expect(page.locator('.fixed-toolbar')).toHaveCount(0)
    await expect(page.locator('.lexical-view-selector')).toHaveCount(0)
    await expect(page.locator('.note-page--editor .rich-text-lexical__label-row')).toBeHidden()
    await expect(editable(page)).toContainText(`E2E editor ${RUN}`)

    // Payload's keyboard hint: not shown on the page (Notion has no such text), still read by screen readers
    await editable(page).click()
    const describedBy = (await editable(page).getAttribute('aria-describedby'))?.split(/\s+/).filter(Boolean) ?? []
    expect(describedBy.length).toBeGreaterThan(0)
    const hint = page
      .locator(describedBy.map((id) => `[id="${id}"]`).join(', '))
      .filter({ hasText: 'move focus out of the editor' })
    await expect(hint).toHaveCount(1)
    const hintBox = (await hint.boundingBox())!
    expect(hintBox.width).toBeLessThanOrEqual(1)
    expect(hintBox.height).toBeLessThanOrEqual(1)
    expect(problems).toEqual([])
  })

  test('slash menu opens on "/" and the inline toolbar on a selection', async ({ page }) => {
    await openEditor(page, note)
    const paragraph = editable(page).locator('p').filter({ hasText: 'Second line of the note' })
    await paragraph.click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/')
    const slash = page.locator('.slash-menu-popup')
    await expect(slash).toBeVisible()
    await expect(slash.locator('.slash-menu-popup__item').first()).toBeVisible()
    await page.keyboard.press('Escape')

    await paragraph.click({ clickCount: 3 })
    await expect(page.locator('.inline-toolbar-popup')).toBeVisible()
  })

  test('empty note shows the Notion placeholder', async ({ page }) => {
    await openEditor(page, empty)
    await expect(page.locator('.note-page--editor').getByText("Type '/' for commands")).toBeVisible()
  })

  test('header (cover + icon) is shown above the editor, without edit controls yet', async ({ page }) => {
    await openEditor(page, note)
    await expect(page.locator('[data-testid="note-cover"] img')).toHaveAttribute('src', cover.url as string)
    await expect(page.locator('[data-testid="note-icon"] img')).toHaveAttribute('src', icon.url as string)
    await expect(page.getByTestId('note-header').locator('button, input')).toHaveCount(0)
  })

  for (const viewport of [
    { height: 844, name: 'phone', width: 390 },
    { height: 1024, name: 'tablet', width: 768 },
    { height: 900, name: 'desktop', width: 1280 },
  ] as const) {
    test(`same layout as the guest view on ${viewport.name} (${viewport.width}px)`, async ({ browser, page }) => {
      await page.setViewportSize({ height: viewport.height, width: viewport.width })
      await openEditor(page, note)
      const heading = editable(page).locator('h1').first()
      const editorHeading = (await heading.boundingBox())!
      const editorIcon = (await page.getByTestId('note-icon').boundingBox())!
      const editorFontSize = await heading.evaluate((el) => getComputedStyle(el).fontSize)

      const guest = await guestPage(browser, viewport)
      const guestHeading = (await guest.page.locator('.note-view h1').first().boundingBox())!
      const guestFontSize = await guest.page.locator('.note-view h1').first().evaluate((el) => getComputedStyle(el).fontSize)
      await guest.context.close()

      // Same typography and the same text column as the read-only view
      expect(editorFontSize).toBe(guestFontSize)
      expect(Math.abs(editorHeading.x - guestHeading.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(editorHeading.width - guestHeading.width)).toBeLessThanOrEqual(1)
      // Icon: centred on phones, on the text column on tablets / desktops
      if (viewport.width < 768) {
        expect(Math.abs(editorIcon.x + editorIcon.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1)
      } else {
        expect(Math.abs(editorIcon.x - editorHeading.x)).toBeLessThanOrEqual(1)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    })
  }

  test('desktop: block handles sit in the left margin, not over the text', async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1280 })
    await openEditor(page, note)
    const heading = editable(page).locator('h1').first()
    await heading.hover()
    const handle = page.locator('.draggable-block-menu')
    await expect(handle).toBeVisible()
    const handleBox = (await handle.boundingBox())!
    const headingBox = (await heading.boundingBox())!
    expect(handleBox.x + handleBox.width).toBeLessThanOrEqual(headingBox.x)
  })

  test('a guest still gets the read-only page', async ({ browser }) => {
    const guest = await guestPage(browser, { height: 900, width: 1280 })
    await expect(guest.page.locator('[contenteditable="true"]')).toHaveCount(0)
    await guest.context.close()
  })
})

test.describe('Payload admin keeps its own editor', () => {
  test('notes edit view: default view, fixed toolbar, no visible view selector', async ({ page }) => {
    const problems = watchProblems(page)
    await loginAs(page, admin)
    await page.goto(`${BASE}/collections/notes/${note.id}`)
    const field = page.locator('.notion-field[data-lexical-view]')
    await expect(field).toHaveAttribute('data-lexical-view', 'default', { timeout: 60000 })
    await expect(page.locator('.fixed-toolbar')).toBeVisible()
    await expect(page.locator('.notion-field .rich-text-lexical__label-row')).toBeVisible()
    // Payload renders the selector (the field has a second view); it must not be visible in the admin
    await expect(page.locator('.lexical-view-selector')).toBeHidden()
    expect(problems).toEqual([])
  })
})
