import { type Browser, expect, type Locator, type Page, test } from '@playwright/test'

import type { Note } from '../../src/payload-types.js'
import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'
import { createNoteSeeder, noteWithTable, type SeedTable } from '../helpers/seedNotes'

/*
 * Tables on the note page (Lexical `notion` view): Payload's table controls (hover "+", cell menu, resizer), styled
 * like Notion, and looking exactly like the read-only (guest) view. The Payload admin keeps Payload's table look.
 */

const BASE = 'http://localhost:3000'
const RUN = Date.now().toString(36)
const seed = createNoteSeeder()
const member: TestAccount = { password: 'e2e-pass-1234', role: 'user', username: `e2e-table-${RUN}` }
const admin: TestAccount = { password: 'e2e-pass-1234', role: 'admin', username: `e2e-table-admin-${RUN}` }

const HEAD = ['Project', 'Owner', 'Status']
const ROWS = [
  ['Alpha', 'Ali', 'Done'],
  ['Beta', 'Sara', 'A longer status that wraps inside its column'],
]

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

const tableNote = (name: string, table: Partial<SeedTable> = {}) =>
  seed.noteWithContent(noteWithTable(`E2E table ${name} ${RUN}`, { rows: [HEAD, ...ROWS], ...table }))

const editorTable = (page: Page) => page.locator('.note-page--editor table')
const status = (page: Page) => page.getByTestId('note-save-status')

const openNote = async (page: Page, note: Note, account: TestAccount = member) => {
  await loginAs(page, account)
  await page.goto(`${BASE}/${note.slug}`)
  await expect(editorTable(page)).toBeVisible({ timeout: 60000 })
}

const openGuest = async (browser: Browser, note: Note, width = 1280) => {
  const context = await browser.newContext({ viewport: { height: 900, width } })
  const page = await context.newPage()
  await page.goto(`${BASE}/${note.slug}`)
  await expect(page.locator('.note-view__table')).toBeVisible()
  return { close: () => context.close(), page }
}

/** Geometry and the styles that make a table look the way it does. */
const measure = (table: Locator) =>
  table.evaluate((element) => {
    const look = (cell: Element) => {
      const style = getComputedStyle(cell)
      return {
        background: style.backgroundColor,
        border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        padding: style.padding,
      }
    }
    const rows = [...element.querySelectorAll('tr')]
    return {
      columns: [...rows[0].children].map((cell) => Math.round(cell.getBoundingClientRect().width)),
      header: look(rows[0].children[0]),
      rowHeights: rows.map((row) => Math.round(row.getBoundingClientRect().height)),
      rows: rows.map((row) => look(row.children[1])),
      width: Math.round(element.getBoundingClientRect().width),
    }
  })

/** The table as stored in the note. */
const storedTable = async (page: Page, id: number) => {
  const note = (await (await page.request.get(`${BASE}/api/notes/${id}?depth=0`)).json()) as Note
  const children = (note.note as unknown as { root: { children: { type: string }[] } }).root.children
  return children.find((child) => child.type === 'table') as unknown as {
    children: { children: { children: { children?: { text: string }[] }[]; headerState: number }[] }[]
    colWidths?: number[]
    frozenColumnCount?: number
    rowStriping?: boolean
  }
}

const cellText = (cell: { children: { children?: { text: string }[] }[] }) =>
  cell.children.map((paragraph) => (paragraph.children ?? []).map((text) => text.text).join('')).join('\n')

/** Moves the mouse onto a cell (Payload shows its hover "+" buttons on mouse move). */
const hover = async (page: Page, cell: Locator) => {
  const box = (await cell.boundingBox())!
  await page.mouse.move(box.x + 8, box.y + 8)
  await page.mouse.move(box.x + 16, box.y + 12)
}

const openCellMenu = async (page: Page, cell: Locator) => {
  await cell.click()
  await page.locator('.table-cell-action-button').click()
  const menu = page.locator('.table-action-menu-dropdown')
  await expect(menu).toBeVisible()
  return menu
}

const waitSaved = (page: Page) => expect(status(page)).toHaveAttribute('data-state', 'saved', { timeout: 20000 })

test.describe('Notion table on the note page', () => {
  for (const width of [1280, 390]) {
    test(`editor and guest view look exactly the same (${width}px, saved widths, striping, frozen column)`, async ({ browser, page }) => {
      await page.setViewportSize({ height: 900, width })
      const note = await tableNote(`same-${width}`, { colWidths: [160, 140, 220], frozenColumnCount: 1, rowStriping: true })
      await openNote(page, note)
      const editor = await measure(editorTable(page))
      const guest = await openGuest(browser, note, width)
      const read = await measure(guest.page.locator('.note-view__table'))
      await guest.close()

      expect(editor).toEqual(read)
      expect(editor.columns).toEqual([160, 140, 220])
      // Notion look: 14px text, light header, the 2nd body row striped
      expect(editor.header.fontSize).toBe('14px')
      expect(editor.header.fontWeight).toBe('500')
      expect(editor.rows[2].background).not.toBe(editor.rows[1].background)
    })
  }

  test('a table saved without widths gets the editor’s 92px columns in the guest view too', async ({ browser, page }) => {
    const note = await tableNote('no-widths')
    const guest = await openGuest(browser, note)
    const read = await measure(guest.page.locator('.note-view__table'))
    await guest.close()
    expect(read.columns).toEqual([92, 92, 92])

    await openNote(page, note)
    expect(await measure(editorTable(page))).toEqual(read)
  })

  test('a wide table scrolls sideways inside its box; the frozen first column stays put (phone)', async ({ browser, page }) => {
    await page.setViewportSize({ height: 900, width: 390 })
    const note = await tableNote('frozen', { colWidths: [150, 200, 300], frozenColumnCount: 1 })
    await openNote(page, note)
    const guest = await openGuest(browser, note, 390)

    for (const [view, scroller] of [
      [page, page.locator('.note-page--editor .LexicalEditorTheme__tableScrollableWrapper')],
      [guest.page, guest.page.locator('.note-view__table-scroll')],
    ] as const) {
      // The page itself never scrolls sideways
      expect(await view.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
      expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
      await scroller.evaluate((element) => {
        element.scrollLeft = 200
      })
      const positions = await scroller.evaluate((element) => {
        const row = element.querySelectorAll('tr')[1]
        return {
          first: row.children[0].getBoundingClientRect().left,
          firstBackground: getComputedStyle(row.children[0]).backgroundColor,
          second: row.children[1].getBoundingClientRect().left,
        }
      })
      // Stuck to the screen edge, opaque, with the next column passing underneath
      expect(Math.round(positions.first)).toBe(0)
      expect(positions.second).toBeLessThan(positions.first)
      expect(positions.firstBackground).not.toBe('rgba(0, 0, 0, 0)')
    }
    await guest.close()
  })

  test('the hover "+" under the last row and after the last column add a row / column, saved and shown to guests', async ({ browser, page }) => {
    const note = await tableNote('hover-add', { colWidths: [120, 120, 120] })
    await openNote(page, note)

    await hover(page, editorTable(page).locator('tr').last().locator('td').first())
    const addRow = page.getByRole('button', { name: 'Add Row' })
    await expect(addRow).toBeVisible()
    // Quiet until hovered (Notion), placed right under the table
    const tableBox = (await editorTable(page).boundingBox())!
    const rowBox = (await addRow.boundingBox())!
    expect(rowBox.y).toBeGreaterThanOrEqual(tableBox.y + tableBox.height)
    expect(rowBox.y).toBeLessThan(tableBox.y + tableBox.height + 20)
    await addRow.click()
    await expect(editorTable(page).locator('tr')).toHaveCount(4)

    await hover(page, editorTable(page).locator('tr').nth(1).locator('td').last())
    const addColumn = page.getByRole('button', { name: 'Add Column' })
    await expect(addColumn).toBeVisible()
    await addColumn.click()
    await expect(editorTable(page).locator('tr').first().locator('th, td')).toHaveCount(4)

    await waitSaved(page)
    const stored = await storedTable(page, note.id)
    expect(stored.children).toHaveLength(4)
    expect(stored.children.every((row) => row.children.length === 4)).toBe(true)
    expect(stored.colWidths).toHaveLength(4)

    const guest = await openGuest(browser, note)
    await expect(guest.page.locator('.note-view__table tr')).toHaveCount(4)
    await expect(guest.page.locator('.note-view__table tr').first().locator('th, td')).toHaveCount(4)
    await guest.close()
  })

  test('the cell menu (Notion look) inserts / deletes rows and columns and toggles headers, striping and freeze', async ({ browser, page }) => {
    const note = await tableNote('menu', { colWidths: [120, 120, 120] })
    await openNote(page, note)
    const firstBodyCell = () => editorTable(page).locator('tr').nth(1).locator('td').first()

    let menu = await openCellMenu(page, firstBodyCell())
    // Restyled on the note page only
    expect(await menu.evaluate((element) => getComputedStyle(element).minWidth)).toBe('220px')
    expect(await menu.locator('.item').first().evaluate((element) => getComputedStyle(element).fontSize)).toBe('14px')
    await menu.locator('[data-test-id="table-insert-row-below"]').click()
    await expect(editorTable(page).locator('tr')).toHaveCount(4)

    menu = await openCellMenu(page, firstBodyCell())
    await menu.locator('[data-test-id="table-delete-columns"]').click()
    await expect(editorTable(page).locator('tr').first().locator('th, td')).toHaveCount(2)

    menu = await openCellMenu(page, firstBodyCell())
    await menu.locator('[data-test-id="table-column-header"]').click()
    // The whole first column is now a header column (the header row stays a header row)
    await expect
      .poll(() =>
        editorTable(page).evaluate((table) =>
          [...table.querySelectorAll('tr')].map((row) => [...row.children].map((cell) => cell.tagName).join(',')),
        ),
      )
      .toEqual(['TH,TH', 'TH,TD', 'TH,TD', 'TH,TD'])

    menu = await openCellMenu(page, editorTable(page).locator('tr').nth(1).locator('td').first())
    await menu.locator('[data-test-id="table-row-striping"]').click()
    menu = await openCellMenu(page, editorTable(page).locator('tr').nth(1).locator('td').first())
    await menu.locator('[data-test-id="table-freeze-first-column"]').click()
    await expect(editorTable(page)).toHaveAttribute('data-lexical-row-striping', 'true')
    await expect(editorTable(page)).toHaveAttribute('data-lexical-frozen-column', 'true')

    await waitSaved(page)
    const stored = await storedTable(page, note.id)
    expect(stored.children).toHaveLength(4)
    expect(stored.children[0].children.map(cellText)).toEqual(['Owner', 'Status'])
    expect(stored.children[1].children[0].headerState).toBeGreaterThan(0)
    expect(stored.rowStriping).toBe(true)
    expect(stored.frozenColumnCount).toBe(1)

    // Same look for guests (and still the same after a reload of the editor)
    const guest = await openGuest(browser, note)
    const guestTable = guest.page.locator('.note-view__table')
    await expect(guestTable).toHaveClass(/note-view__table--striped/)
    await expect(guestTable).toHaveClass(/note-view__table--frozen-column/)
    const read = await measure(guestTable)
    await guest.close()
    await page.reload()
    await expect(editorTable(page)).toBeVisible({ timeout: 60000 })
    expect(await measure(editorTable(page))).toEqual(read)
  })

  test('"/table" inserts a table from the grid, ready to type in, looking like the guest view', async ({ browser, page }) => {
    const note = await seed.note(`E2E table slash ${RUN}`)
    await loginAs(page, member)
    await page.goto(`${BASE}/${note.slug}`)
    const editable = page.locator('.note-page--editor [contenteditable="true"]')
    await expect(editable).toBeVisible({ timeout: 60000 })
    await editable.locator('p').last().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/table')
    await page.locator('.slash-menu-popup__item-table').click()
    await page.getByRole('button', { name: '3 columns, 2 rows' }).click()
    await expect(editorTable(page).locator('tr')).toHaveCount(2)
    await page.keyboard.type('Typed in a cell')
    await expect(editorTable(page)).toContainText('Typed in a cell')

    await waitSaved(page)
    const guest = await openGuest(browser, note)
    const read = await measure(guest.page.locator('.note-view__table'))
    await expect(guest.page.locator('.note-view__table')).toContainText('Typed in a cell')
    await guest.close()
    expect(await measure(editorTable(page))).toEqual(read)
  })
})

test.describe('Payload admin keeps its own table look', () => {
  test('the notes edit view table and cell menu are not restyled', async ({ page }) => {
    const note = await tableNote('admin', { colWidths: [120, 120, 120] })
    await loginAs(page, admin)
    await page.goto(`${BASE}/collections/notes/${note.id}`)
    const table = page.locator('.notion-field[data-lexical-view="default"] table')
    await expect(table).toBeVisible({ timeout: 60000 })
    const cell = table.locator('td').first()
    const look = await cell.evaluate((element) => {
      const style = getComputedStyle(element)
      return { fontSize: style.fontSize, padding: style.padding }
    })
    expect(look.padding).not.toBe('7px 9px')
    expect(look.fontSize).not.toBe('14px')

    await cell.click()
    await page.locator('.table-cell-action-button').click()
    const menu = page.locator('.table-action-menu-dropdown')
    await expect(menu).toBeVisible()
    expect(await menu.evaluate((element) => getComputedStyle(element).minWidth)).not.toBe('220px')
  })
})
