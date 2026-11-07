import fs from 'node:fs'
import path from 'node:path'

import { expect, type Page, test } from '@playwright/test'

import type { Media } from '../../src/payload-types.js'
import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'
import { createNoteSeeder, FIXTURE_IMAGES } from '../helpers/seedNotes'

/*
 * The Media collection accepts images only (PNG, JPEG, GIF, WebP, AVIF up to 10 MB) on the server, for everyone:
 * members through REST (what the note page uses) and admins in the Payload admin.
 */

const BASE = 'http://localhost:3000'
const RUN = Date.now().toString(36)
const seed = createNoteSeeder()
const member: TestAccount = { password: 'e2e-pass-1234', role: 'user', username: `e2e-media-${RUN}` }
const admin: TestAccount = { password: 'e2e-pass-1234', role: 'admin', username: `e2e-media-admin-${RUN}` }
const FIXTURES = path.dirname(FIXTURE_IMAGES.icon)

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await seedAccount(member)
  await seedAccount(admin)
})

test.afterAll(async () => {
  await seed.cleanup()
  await deleteAccount(member.username)
  await deleteAccount(admin.username)
})

/** `POST /api/media` with the login cookie, the way the note page uploads. */
const postMedia = (page: Page, file: { buffer: Buffer; mimeType: string; name: string }) =>
  page.request.post(`${BASE}/api/media`, {
    // Same origin, like the page's own `fetch` (Payload's CSRF check refuses cookie requests without it)
    headers: { origin: BASE },
    multipart: { _payload: JSON.stringify({ alt: `E2E media ${RUN} ${file.name}` }), file },
  })

const countMine = async (page: Page) =>
  ((await (await page.request.get(`${BASE}/api/media?where[alt][like]=${RUN}&limit=0&depth=0`)).json()) as { totalDocs: number })
    .totalDocs

test('REST: images are accepted; SVG, text, HTML and disguised files are refused (400), nothing is stored', async ({ page }) => {
  await loginAs(page, member)
  for (const [name, mimeType] of [
    ['icon.png', 'image/png'],
    ['tiny.jpg', 'image/jpeg'],
    ['tiny.gif', 'image/gif'],
    ['tiny.webp', 'image/webp'],
    ['tiny.avif', 'image/avif'],
  ] as const) {
    const response = await postMedia(page, { buffer: fs.readFileSync(path.join(FIXTURES, name)), mimeType, name: `${RUN}-${name}` })
    expect(response.status(), name).toBe(201)
    seed.adopt('media', ((await response.json()) as { doc: Media }).doc.id)
  }
  const accepted = await countMine(page)
  expect(accepted).toBe(5)

  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
  const html = Buffer.from('<html><script>alert(1)</script></html>')
  for (const file of [
    { buffer: svg, mimeType: 'image/svg+xml', name: 'logo.svg' },
    { buffer: svg, mimeType: 'image/png', name: 'logo.png' },
    { buffer: html, mimeType: 'text/html', name: 'page.html' },
    { buffer: html, mimeType: 'image/jpeg', name: 'page.jpg' },
    { buffer: Buffer.from('plain text'), mimeType: 'text/plain', name: 'notes.txt' },
  ]) {
    const response = await postMedia(page, file)
    expect(response.status(), file.name).toBe(400)
  }

  const big = Buffer.alloc(10 * 1024 * 1024 + 1)
  fs.readFileSync(FIXTURE_IMAGES.icon).copy(big)
  const tooBig = await postMedia(page, { buffer: big, mimeType: 'image/png', name: 'huge.png' })
  expect(tooBig.status()).toBe(400)
  expect(JSON.stringify(await tooBig.json())).toContain('This image is too large. The maximum is 10 MB.')

  expect(await countMine(page)).toBe(accepted)
})

test('admin: the upload field only offers images, and a text file is refused', async ({ page }) => {
  await loginAs(page, admin)
  await page.goto(`${BASE}/collections/media/create`)
  const input = page.locator('input[type="file"]').first()
  await expect(input).toBeAttached({ timeout: 60000 })
  expect((await input.getAttribute('accept'))?.split(',').map((type) => type.trim())).toEqual([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/avif',
  ])

  const before = await countMine(page)
  await input.setInputFiles({ buffer: Buffer.from('plain text'), mimeType: 'text/plain', name: `${RUN}-notes.txt` })
  await page.locator('#field-alt').fill(`E2E media ${RUN} admin text`)
  await page.keyboard.press('ControlOrMeta+s')
  await expect(page.getByText(/not allowed|invalid/i).first()).toBeVisible({ timeout: 20000 })
  expect(await countMine(page)).toBe(before)
})
