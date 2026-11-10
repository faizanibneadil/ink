import { expect, type Page, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { deleteAccount, loginAs, seedAccount, type TestAccount } from '../helpers/loginAs'
import { createNoteSeeder, noteWithCodeBlock } from '../helpers/seedNotes'

/*
 * Browser JavaScript downloaded by the main pages (initial load, until the network is idle).
 *
 * Only meaningful against a production server (`pnpm build && pnpm start`): the dev server ships unminified,
 * unsplit code. So it runs only with BUNDLE_E2E=1:
 *
 *   pnpm build && pnpm start          # in another terminal
 *   BUNDLE_E2E=1 pnpm exec playwright test tests/e2e/bundle-size.e2e.spec.ts
 *
 * Numbers are written to test-results/bundle-size.json and printed. The budgets below are upper limits: lower them
 * when a change makes a page lighter, so the saving cannot silently come back.
 */

const BASE = 'http://localhost:3000'
const RUN = Date.now().toString(36)
const KiB = 1024

/** Max JS bytes over the wire (compressed) per page */
const BUDGET_KIB: Record<string, number> = {
  // Baseline (docs/bundle/AUDIT.md): 873 KiB on every page
  'admin dashboard': 920,
  'editor note page': 940,
  // Guests get the light website layout (src/app/(site)): 206 KiB
  'guest note page': 240,
  landing: 240,
}

test.skip(!process.env.BUNDLE_E2E, 'Needs a production server: set BUNDLE_E2E=1 (see the comment at the top)')
test.describe.configure({ mode: 'serial' })

const seed = createNoteSeeder()
const member: TestAccount = { password: 'e2e-pass-1234', role: 'user', username: `e2e-bundle-${RUN}` }
const admin: TestAccount = { password: 'e2e-pass-1234', role: 'admin', username: `e2e-bundle-admin-${RUN}` }
let slug = ''

type Measure = { files: number; rawKiB: number; wireKiB: number }
const results: Record<string, Measure> = {}

test.beforeAll(async () => {
  await seedAccount(member)
  await seedAccount(admin)
  const note = await seed.noteWithContent(
    noteWithCodeBlock(`E2E bundle ${RUN}`, { code: 'const answer = 42\nconsole.log(answer)', language: 'ts' }),
  )
  slug = note.slug ?? ''
})

test.afterAll(async () => {
  await seed.cleanup()
  await deleteAccount(member.username)
  await deleteAccount(admin.username)
  const file = path.resolve('test-results/bundle-size.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(results, null, 2))
  console.table(results)
})

/** Loads `url` with an empty cache and sums every JavaScript response (wire = compressed body bytes). */
const measureJS = async (page: Page, url: string, ready: (page: Page) => Promise<void>): Promise<Measure> => {
  const client = await page.context().newCDPSession(page)
  await client.send('Network.enable')
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })
  const js = new Map<string, { raw: number; wire: number }>()
  const urls = new Map<string, string>()
  client.on('Network.responseReceived', (event) => {
    if (event.type === 'Script') urls.set(event.requestId, event.response.url)
  })
  client.on('Network.dataReceived', (event) => {
    const u = urls.get(event.requestId)
    if (!u) return
    const entry = js.get(u) ?? { raw: 0, wire: 0 }
    entry.raw += event.dataLength
    js.set(u, entry)
  })
  client.on('Network.loadingFinished', (event) => {
    const u = urls.get(event.requestId)
    if (!u) return
    const entry = js.get(u) ?? { raw: 0, wire: 0 }
    entry.wire = event.encodedDataLength
    js.set(u, entry)
  })
  await page.goto(url)
  await ready(page)
  await page.waitForLoadState('networkidle')
  await client.detach()
  const values = [...js.values()]
  return {
    files: values.length,
    rawKiB: Math.round(values.reduce((sum, v) => sum + v.raw, 0) / KiB),
    wireKiB: Math.round(values.reduce((sum, v) => sum + v.wire, 0) / KiB),
  }
}

const check = (name: string, measure: Measure) => {
  results[name] = measure
  expect(measure.files, `${name}: no JavaScript measured`).toBeGreaterThan(0)
  expect(measure.wireKiB, `${name}: ${measure.wireKiB} KiB > budget ${BUDGET_KIB[name]} KiB`).toBeLessThanOrEqual(
    BUDGET_KIB[name],
  )
}

test('landing page', async ({ page }) => {
  check('landing', await measureJS(page, `${BASE}/`, async (p) => {
    await expect(p.getByText('Website Lending Page')).toBeVisible()
  }))
})

test('guest note page', async ({ page }) => {
  check('guest note page', await measureJS(page, `${BASE}/${slug}`, async (p) => {
    await expect(p.locator('.note-view')).toBeVisible()
    await expect(p.locator('.note-view__codeblock .hljs-keyword').first()).toBeVisible()
  }))
})

test('editor note page', async ({ page }) => {
  await loginAs(page, member)
  check('editor note page', await measureJS(page, `${BASE}/${slug}`, async (p) => {
    await expect(p.locator('[data-lexical-editor="true"]')).toBeVisible({ timeout: 60000 })
  }))
})

test('admin dashboard', async ({ page }) => {
  await loginAs(page, admin)
  check('admin dashboard', await measureJS(page, `${BASE}/`, async (p) => {
    await expect(p.locator('.dashboard')).toBeVisible({ timeout: 60000 })
  }))
})
