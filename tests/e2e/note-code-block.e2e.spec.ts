import { expect, type Page, test } from '@playwright/test'

import type { Note } from '../../src/payload-types.js'
import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'
import { createNoteSeeder, noteWithCodeBlock } from '../helpers/seedNotes'

/*
 * Code block on the note page (Lexical `notion` view, src/features/code-block/notion): Notion-style editable block,
 * no Monaco. The Payload admin keeps its Monaco code block.
 */

const BASE = 'http://localhost:3000'
const RUN = Date.now().toString(36)
const seed = createNoteSeeder()
const member: TestAccount = { password: 'e2e-pass-1234', role: 'user', username: `e2e-code-${RUN}` }
const admin: TestAccount = { password: 'e2e-pass-1234', role: 'admin', username: `e2e-code-admin-${RUN}` }
const CODE = 'function hello(name: string) {\n  return `Hi ${name}`\n}'

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { height: 900, width: 1280 } })

test.beforeAll(async () => {
  await seedAccount(member)
  await seedAccount(admin)
})

test.afterAll(async () => {
  await seed.cleanup()
  await deleteAccount(member.username)
  await deleteAccount(admin.username)
})

const block = (page: Page) => page.getByTestId('notion-code-block')
const input = (page: Page) => page.getByTestId('notion-code-input')
const status = (page: Page) => page.getByTestId('note-save-status')

/** Every request whose URL mentions Monaco (its loader / workers / CDN files). */
const trackMonaco = (page: Page) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (/monaco/i.test(request.url())) requests.push(request.url())
  })
  return requests
}

const codeNote = (name: string, language = 'ts', filename = 'hello.ts') =>
  seed.noteWithContent(noteWithCodeBlock(`E2E code ${name} ${RUN}`, { code: CODE, filename, language }))

const openNote = async (page: Page, note: Note) => {
  await loginAs(page, member)
  await page.goto(`${BASE}/${note.slug}`)
  await expect(input(page)).toBeVisible({ timeout: 60000 })
}

/** The code block as stored in the note. */
const storedBlock = async (page: Page, id: number) => {
  const note = (await (await page.request.get(`${BASE}/api/notes/${id}?depth=0`)).json()) as Note
  const children = (note.note as unknown as { root: { children: { type: string }[] } }).root.children
  return children.filter((child) => child.type === 'code-block') as unknown as { code: string; filename?: string; language: string }[]
}

test.describe('Notion code block (note page editor)', () => {
  test('renders the Notion block (no Monaco at all), highlighted, full column width like the guest view', async ({ browser, page }) => {
    const monaco = trackMonaco(page)
    const note = await codeNote('render')
    await openNote(page, note)
    await expect(input(page)).toHaveValue(CODE)
    await expect(block(page).locator('.notion-code-block__language')).toHaveValue('ts')
    await expect(block(page).getByLabel('File name')).toHaveValue('hello.ts')
    await expect(block(page).locator('.notion-code-block__highlight .hljs-keyword').first()).toHaveText('function')
    await expect(page.locator('.monaco-editor, .ink-code-block')).toHaveCount(0)

    const editorBox = (await block(page).boundingBox())!
    const guestContext = await browser.newContext({ viewport: { height: 900, width: 1280 } })
    const guest = await guestContext.newPage()
    await guest.goto(`${BASE}/${note.slug}`)
    const guestBlock = guest.locator('.note-view__codeblock')
    await expect(guestBlock).toBeVisible()
    await expect(guest.locator('textarea')).toHaveCount(0)
    const guestBox = (await guestBlock.boundingBox())!
    await guestContext.close()
    expect(Math.abs(editorBox.width - guestBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(editorBox.x - guestBox.x)).toBeLessThanOrEqual(1)

    // Type a bit: still no Monaco
    await input(page).click()
    await page.keyboard.type(' ')
    await page.waitForTimeout(1500)
    expect(monaco).toEqual([])
  })

  test('typing, Enter and Tab stay inside the block; everything is saved and there after a reload', async ({ page }) => {
    const note = await codeNote('typing')
    await openNote(page, note)
    await input(page).click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await page.keyboard.type('console.log(hello("Ink"))')
    await expect(input(page)).toBeFocused()
    await expect(input(page)).toHaveValue(`${CODE}\n  console.log(hello("Ink"))`)
    // The note around it did not change (Enter did not make a new paragraph)
    await expect(page.locator('.note-page--editor [contenteditable="true"] > p')).toHaveCount(1)

    await expect(status(page)).toHaveAttribute('data-state', 'saved', { timeout: 20000 })
    expect((await storedBlock(page, note.id))[0].code).toBe(`${CODE}\n  console.log(hello("Ink"))`)
    await page.reload()
    await expect(input(page)).toHaveValue(`${CODE}\n  console.log(hello("Ink"))`, { timeout: 60000 })
  })

  test('Backspace / Delete / select-all inside the code never delete the block itself', async ({ page }) => {
    const note = await codeNote('backspace')
    await openNote(page, note)
    await input(page).click()
    await page.keyboard.press('Control+Home')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')
    await expect(block(page)).toHaveCount(1)
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await expect(block(page)).toHaveCount(1)
    await expect(input(page)).toHaveValue('')
    await page.keyboard.press('Backspace')
    await expect(block(page)).toHaveCount(1)
    await expect(status(page)).toHaveAttribute('data-state', 'saved', { timeout: 20000 })
    expect(await storedBlock(page, note.id)).toEqual([expect.objectContaining({ code: '' })])
  })

  test('Shift+Tab outdents the selected lines; Escape leaves the block', async ({ page }) => {
    const note = await codeNote('outdent')
    await openNote(page, note)
    await input(page).click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Tab')
    await expect(input(page)).toHaveValue(CODE.split('\n').map((line) => `  ${line}`).join('\n'))
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(input(page)).toHaveValue('function hello(name: string) {\nreturn `Hi ${name}`\n}')
    await page.keyboard.press('Escape')
    await expect(input(page)).not.toBeFocused()
  })

  test('language and file name are saved', async ({ page }) => {
    const note = await codeNote('language')
    await openNote(page, note)
    await block(page).locator('.notion-code-block__language').selectOption('python')
    await block(page).getByLabel('File name').fill('hello.py')
    await expect(status(page)).toHaveAttribute('data-state', 'saved', { timeout: 20000 })
    expect(await storedBlock(page, note.id)).toEqual([expect.objectContaining({ filename: 'hello.py', language: 'python' })])
    await page.reload()
    await expect(block(page).locator('.notion-code-block__language')).toHaveValue('python', { timeout: 60000 })
    await expect(block(page).getByLabel('Code (Python)')).toBeVisible()
  })

  test('Copy puts the code on the clipboard', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const note = await codeNote('copy')
    await openNote(page, note)
    await block(page).hover()
    await block(page).getByRole('button', { name: 'Copy code' }).click()
    await expect(block(page).getByRole('button', { name: 'Copied' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODE)
  })

  test('Delete removes the block (and only it)', async ({ page }) => {
    const note = await codeNote('delete')
    await openNote(page, note)
    await block(page).hover()
    await block(page).getByRole('button', { name: 'Delete code block' }).click()
    await expect(block(page)).toHaveCount(0)
    await expect(page.locator('.note-page--editor [contenteditable="true"]')).toContainText('After the code')
    await expect(status(page)).toHaveAttribute('data-state', 'saved', { timeout: 20000 })
    expect(await storedBlock(page, note.id)).toEqual([])
  })

  test('"/code" inserts a new block with the caret in it; it is saved', async ({ page }) => {
    const monaco = trackMonaco(page)
    const note = await seed.note(`E2E code insert ${RUN}`)
    await loginAs(page, member)
    await page.goto(`${BASE}/${note.slug}`)
    const editor = page.locator('.note-page--editor [contenteditable="true"]')
    await expect(editor).toBeVisible({ timeout: 60000 })
    await editor.locator('p').last().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/code')
    await page.locator('.slash-menu-popup__item', { hasText: 'Code Block' }).click()
    await expect(input(page)).toBeFocused()
    await page.keyboard.type('SELECT 1;')
    await expect(status(page)).toHaveAttribute('data-state', 'saved', { timeout: 20000 })
    expect(await storedBlock(page, note.id)).toEqual([expect.objectContaining({ code: 'SELECT 1;' })])
    expect(monaco).toEqual([])
  })
})

test.describe('Payload admin keeps its Monaco code block', () => {
  test('the notes edit view renders the admin code block, not the Notion one', async ({ page }) => {
    const note = await codeNote('admin')
    await loginAs(page, admin)
    await page.goto(`${BASE}/collections/notes/${note.id}`)
    await expect(page.locator('.notion-field[data-lexical-view="default"]')).toBeVisible({ timeout: 60000 })
    await expect(page.locator('.ink-code-block')).toBeVisible({ timeout: 60000 })
    await expect(page.getByTestId('notion-code-block')).toHaveCount(0)
  })
})
