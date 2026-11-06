#!/usr/bin/env node
/*
 * End-to-end scenarios for "Payload admin + website on `/`" against the real Cloudflare runtime (workerd, via
 * `wrangler dev`) with local D1 databases. Nothing here touches a remote database.
 *
 *   pnpm test:workerd                        # uses the existing `.open-next` build (run `pnpm build:cloudflare` first)
 *   pnpm test:workerd --build                # builds first
 *   pnpm test:workerd --with-custom-view     # also tests a temporary custom view (/test-view); needs a clean git tree,
 *                                            # adds the view, rebuilds, tests, then restores every file
 *
 * Scenarios: migration safety (existing data kept, users -> admin, slug clash guard, note cover / icon columns), guest / admin / `user` role
 * routing and REST access, notes at `/<slug>`, 404s, custom views (rendered for everyone, before any note lookup),
 * and the first user on an empty database.
 *
 * Exit code 1 when any check fails.
 */
import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = new Set(process.argv.slice(2))
const WITH_CUSTOM_VIEW = args.has('--with-custom-view')
const BUILD = args.has('--build') || WITH_CUSTOM_VIEW
const PASSWORD = 'pass1234'
const SECRET = 'workerd-test-secret'
const TMP_FILES = [] // removed in cleanup
const RESTORE = [] // git paths restored in cleanup

// ------------------------------------------------------------------ results
const results = []
const check = (name, ok, info = '') => {
  results.push({ info, name, ok: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  — ${info}` : ''}`)
}
const section = (title) => console.log(`\n=== ${title}`)

// ------------------------------------------------------------------ shell helpers
const run = (cmd, cmdArgs, { allowFail = false, env = {} } = {}) => {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  if (r.status !== 0 && !allowFail) {
    throw new Error(`${cmd} ${cmdArgs.join(' ')} failed:\n${out.slice(-4000)}`)
  }
  return { ok: r.status === 0, out }
}

const wranglerConfig = (dbId, port) => {
  const file = path.join(ROOT, `wrangler.workerd-test-${dbId}.jsonc`)
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        name: 'ink',
        main: '.open-next/worker.js',
        compatibility_date: '2026-10-01',
        compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
        assets: { directory: '.open-next/assets', binding: 'ASSETS' },
        vars: { SERVER_URL: `http://localhost:${port}` },
        d1_databases: [{ binding: 'D1', database_id: `workerd-test-${dbId}`, database_name: `ink-test-${dbId}` }],
        r2_buckets: [{ binding: 'R2', bucket_name: `ink-test-${dbId}` }],
      },
      null,
      2,
    ),
  )
  TMP_FILES.push(file)
  return path.basename(file)
}

const migrate = (config) =>
  run('pnpm', ['exec', 'payload', 'migrate'], {
    allowFail: true,
    env: {
      CLOUDFLARE_REMOTE_BINDINGS: 'true',
      CLOUDFLARE_WRANGLER_CONFIG: config,
      NODE_ENV: 'production',
      NODE_OPTIONS: '--no-deprecation',
      PAYLOAD_SECRET: SECRET,
    },
  })

const sql = (config, command) => {
  const r = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'D1', '--local', '-c', config, '--json', '--command', command], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    maxBuffer: 64 * 1024 * 1024,
  })
  // stdout = the JSON array (warnings go to stderr, but stay tolerant of extra lines around it)
  const out = r.stdout ?? ''
  const start = out.search(/^\[\s*$/m)
  const end = out.search(/^\]\s*$/m)
  if (r.status !== 0 || start < 0 || end < 0) {
    throw new Error(`d1 execute failed (${command}):\n${out.slice(-2000)}\n${(r.stderr ?? '').slice(-2000)}`)
  }
  return JSON.parse(out.slice(start, end + 1))[0]?.results ?? []
}

const hash = (password) => {
  const salt = crypto.randomBytes(32).toString('hex')
  return { hash: `pbkdf2-sha256-100k-v1:${crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')}`, salt }
}
const q = (value) => `'${String(value).replaceAll("'", "''")}'`
const lexical = (text) =>
  JSON.stringify({
    root: {
      type: 'root', version: 1, direction: null, format: '', indent: 0,
      children: [{
        type: 'paragraph', version: 1, direction: null, format: '', indent: 0, textFormat: 0, textStyle: '',
        children: [{ type: 'text', version: 1, text, format: 0, mode: 'normal', style: '', detail: 0 }],
      }],
    },
  })
const insertUser = (config, id, username, role) => {
  const { hash: h, salt } = hash(PASSWORD)
  const cols = role ? '(id, username, salt, hash, role)' : '(id, username, salt, hash)'
  const vals = role ? `(${id}, ${q(username)}, ${q(salt)}, ${q(h)}, ${q(role)})` : `(${id}, ${q(username)}, ${q(salt)}, ${q(h)})`
  sql(config, `INSERT INTO users ${cols} VALUES ${vals};`)
}
const insertNote = (config, id, slug, text) =>
  sql(config, `INSERT INTO notes (id, slug, note) VALUES (${id}, ${q(slug)}, ${q(lexical(text))});`)

const startServer = async (config, port) => {
  const env = path.join(ROOT, `.dev.vars.workerd-test-${port}`)
  fs.writeFileSync(env, `PAYLOAD_SECRET=${SECRET}\n`)
  TMP_FILES.push(env)
  const child = spawn('pnpm', ['exec', 'wrangler', 'dev', '-c', config, '--env-file', env, '--port', String(port)], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', (d) => (log += d))
  child.stderr.on('data', (d) => (log += d))
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/api/users/me`)
      if (r.status < 500) return { child, log: () => log }
    } catch {}
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`wrangler dev did not start:\n${log.slice(-3000)}`)
}
const stopServer = (server) => {
  try {
    process.kill(-server.child.pid, 'SIGTERM')
  } catch {}
}

// ------------------------------------------------------------------ browser helpers
const launch = async () => {
  try {
    return await chromium.launch()
  } catch {
    return chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
  }
}

const persona = async (browser, base) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  page.problems = []
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`))
  page.on('response', (r) => {
    if (r.status() >= 500) page.problems.push(`${r.status()} ${r.request().method()} ${r.url()}`)
  })
  page.go = async (p) => {
    const response = await page.goto(base + p, { timeout: 120000 })
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {})
    return response
  }
  page.path = () => {
    const u = new URL(page.url())
    return u.pathname + u.search
  }
  return { context, page }
}

const has = async (page, selector) => (await page.locator(selector).count()) > 0
const isDashboard = (page) => has(page, '.dashboard')
const isLanding = async (page) => (await page.content()).includes('Website Lending Page')
const isLogin = (page) => has(page, 'form.login__form')
// Payload's NotFound view (`.not-found`). Not the text "Nothing found": Payload serializes all its translations
// into every admin page.
const isNotFound = (page) => has(page, '.not-found')
const isEditor = (page) => has(page, '[contenteditable="true"]')
const isTestView = (page) => has(page, '[data-test="test-view"]')

const login = async (page, username) => {
  await page.go('/login')
  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', PASSWORD)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {})
}

const api = (page, method, url, body) =>
  page.evaluate(
    async ({ body, method, url }) => {
      const r = await fetch(url, {
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        method,
      })
      let json = null
      try {
        json = await r.json()
      } catch {}
      return { json, status: r.status }
    },
    { body, method, url },
  )

// ------------------------------------------------------------------ custom view (temporary)
const TEST_VIEW_FILE = path.join(ROOT, 'src/views/test-view.tsx')
const CONFIG_FILE = path.join(ROOT, 'src/payload.config.ts')

const addCustomView = () => {
  const dirty = run('git', ['status', '--porcelain']).out.trim()
  if (dirty) throw new Error(`--with-custom-view needs a clean git tree (it restores files with git):\n${dirty}`)
  fs.writeFileSync(
    TEST_VIEW_FILE,
    `import type { AdminViewServerProps } from 'payload'

// Temporary view added by tests/workerd/run.mjs --with-custom-view. Never committed.
export const TestView = ({ params, user }: AdminViewServerProps) => {
  const segments = params?.segments ?? []
  return (
    <div data-test="test-view">
      Test view: /{Array.isArray(segments) ? segments.join('/') : segments} ({user ? 'logged in' : 'guest'})
    </div>
  )
}
`,
  )
  TMP_FILES.push(TEST_VIEW_FILE)
  const config = fs.readFileSync(CONFIG_FILE, 'utf8')
  const marker = '    components: {\n'
  if (!config.includes(marker)) throw new Error('payload.config.ts: admin.components not found')
  fs.writeFileSync(
    CONFIG_FILE,
    config.replace(
      marker,
      `${marker}      views: {\n        testView: { path: '/test-view', Component: '@/views/test-view.tsx#TestView' },\n      },\n`,
    ),
  )
  RESTORE.push('src/payload.config.ts', 'src/app/importMap.js')
  run('pnpm', ['run', 'generate:importmap'], { env: { PAYLOAD_SECRET: SECRET } })
}

const cleanup = () => {
  for (const file of TMP_FILES) fs.rmSync(file, { force: true, recursive: true })
  if (RESTORE.length) run('git', ['checkout', '--', ...RESTORE], { allowFail: true })
  fs.rmSync(path.join(ROOT, '.wrangler/state'), { force: true, recursive: true })
}

// ------------------------------------------------------------------ scenarios
const NEW_MIGRATION = '20261105_190440_add_user_role'

async function migrationScenario(config) {
  section('Migration safety (existing data, slug clash guard)')
  // Database as production has it today: every migration except the new one, with data
  const hold = path.join(ROOT, '.wrangler/workerd-test-migration-hold')
  fs.mkdirSync(hold, { recursive: true })
  const migrationFiles = fs.readdirSync(path.join(ROOT, 'src/migrations')).filter((f) => f.startsWith(NEW_MIGRATION))
  for (const f of migrationFiles) fs.renameSync(path.join(ROOT, 'src/migrations', f), path.join(hold, f))
  try {
    const before = migrate(config)
    check('earlier migrations run', before.ok, before.ok ? '' : before.out.slice(-500))
  } finally {
    for (const f of migrationFiles) fs.renameSync(path.join(hold, f), path.join(ROOT, 'src/migrations', f))
  }

  insertUser(config, 1, 'olduser1')
  insertUser(config, 2, 'olduser2')
  insertNote(config, 1, 'hello-world', 'Hello world note')
  insertNote(config, 2, 'login', 'Login clash note')
  insertNote(config, 3, 'second-note', 'Second note text')
  if (WITH_CUSTOM_VIEW) insertNote(config, 4, 'test-view', 'Note that a custom view must hide')
  const snapshot = () => ({
    notes: sql(config, 'SELECT id, slug, note, created_at FROM notes ORDER BY id'),
    users: sql(config, 'SELECT id, username, salt, hash, created_at FROM users ORDER BY id'),
  })
  const beforeData = snapshot()

  const clash = migrate(config)
  check('guard stops the migration on a clashing slug', !clash.ok && clash.out.includes('"login"'))
  if (WITH_CUSTOM_VIEW) {
    check('guard also reports a slug that equals a custom view path', clash.out.includes('"test-view"'))
  }
  const roleColumn = sql(config, "SELECT name FROM pragma_table_info('users') WHERE name = 'role'")
  check('guard failure leaves the database unchanged (no role column)', roleColumn.length === 0)
  check('guard failure keeps all data', JSON.stringify(snapshot()) === JSON.stringify(beforeData))

  sql(config, "UPDATE notes SET slug = 'login-note' WHERE id = 2")
  if (WITH_CUSTOM_VIEW) {
    // Re-added after the migration below, as if the custom view had been added to the config later
    sql(config, 'DELETE FROM notes WHERE id = 4')
    beforeData.notes = beforeData.notes.filter((n) => n.id !== 4)
  }
  const fixed = migrate(config)
  check('migration runs after the slug is renamed', fixed.ok, fixed.ok ? '' : fixed.out.slice(-500))

  const after = snapshot()
  const expectedNotes = beforeData.notes.map((n) => (n.id === 2 ? { ...n, slug: 'login-note' } : n))
  check('note rows identical after migration (content, ids, dates)', JSON.stringify(after.notes) === JSON.stringify(expectedNotes))
  check('user rows identical after migration (passwords, ids, dates)', JSON.stringify(after.users) === JSON.stringify(beforeData.users))
  const roles = sql(config, 'SELECT username, role FROM users ORDER BY id')
  check('existing users became admins', roles.length === 2 && roles.every((u) => u.role === 'admin'), JSON.stringify(roles))

  // 20261106_212540_add_note_cover_icon: Notion-style header (cover, icon, cover position)
  const header = sql(config, 'SELECT id, cover_id, icon_id, cover_position FROM notes ORDER BY id')
  check(
    'existing notes: no cover / icon, cover position 50',
    header.length === expectedNotes.length &&
      header.every((n) => n.cover_id === null && n.icon_id === null && Number(n.cover_position) === 50),
    JSON.stringify(header),
  )
  // D1 enforces foreign keys: deleting a media file that is a cover / icon must clear it, not fail
  sql(config, "INSERT INTO media (id, alt, filename) VALUES (900, 'workerd cover', 'workerd-cover.png');")
  sql(config, 'UPDATE notes SET cover_id = 900, icon_id = 900 WHERE id = 3;')
  sql(config, 'DELETE FROM media WHERE id = 900;')
  const cleared = sql(config, 'SELECT cover_id, icon_id FROM notes WHERE id = 3')
  check(
    'deleting a cover / icon media clears the note fields (ON DELETE set null)',
    cleared[0]?.cover_id === null && cleared[0]?.icon_id === null,
    JSON.stringify(cleared),
  )

  insertUser(config, 3, 'normaluser', 'user')
  if (WITH_CUSTOM_VIEW) insertNote(config, 4, 'test-view', 'Note that a custom view must hide')
}

async function guestScenario(browser, base) {
  section('Guest')
  const { context, page } = await persona(browser, base)
  await page.go('/')
  check('guest / → landing page', (await isLanding(page)) && page.path() === '/', page.path())
  await page.go('/?v=w')
  check('guest /?v=w → landing page', await isLanding(page))
  for (const p of ['/?v=d', '/collections/notes', '/collections/users/1', '/globals/settings', '/account']) {
    await page.go(p)
    check(`guest ${p} → login`, (await isLogin(page)) && page.path().startsWith('/login'), page.path())
  }
  await page.go('/login')
  check('guest /login → login form', await isLogin(page))
  await page.go('/forgot')
  check('guest /forgot → forgot password page', page.path() === '/forgot' && (await has(page, 'form')), page.path())
  for (const p of ['/reset/some-token', '/users/verify/some-token', '/unauthorized']) {
    const r = await page.go(p)
    check(`guest ${p} → Payload page`, r.status() < 400 && !(await isNotFound(page)) && !(await isLanding(page)), `${r.status()} ${page.path()}`)
  }
  await page.go('/hello-world')
  check('guest /hello-world → note, read-only', (await page.content()).includes('Hello world note') && !(await isEditor(page)))
  await page.go('/login-note')
  check('guest /login-note → renamed note', (await page.content()).includes('Login clash note'))
  for (const p of ['/does-not-exist', '/hello-world/extra', '/a/b/c']) {
    await page.go(p)
    check(`guest ${p} → 404 page`, await isNotFound(page), page.path())
  }
  // Payload checks unknown collections before auth, so this is a 404 even for a guest
  await page.go('/collections/nope')
  check('guest /collections/nope → 404 page', await isNotFound(page), page.path())
  await page.go('/')
  check('guest REST GET /api/notes', (await api(page, 'GET', '/api/notes')).status === 200)
  check('guest REST POST /api/notes → 403', (await api(page, 'POST', '/api/notes', {})).status === 403)
  check('guest REST PATCH /api/notes/1 → 403', (await api(page, 'PATCH', '/api/notes/1', { slug: 'x' })).status === 403)
  check('guest REST DELETE /api/notes/1 → 403', (await api(page, 'DELETE', '/api/notes/1')).status === 403)
  check('guest REST GET /api/users → 403', (await api(page, 'GET', '/api/users')).status === 403)
  check('guest: no server/page errors', page.problems.length === 0, page.problems.join(' | '))
  await context.close()
}

async function adminScenario(browser, base) {
  section('Admin')
  const { context, page } = await persona(browser, base)
  await login(page, 'olduser1')
  check('admin login → dashboard', await isDashboard(page), page.path())
  const reopened = await context.newPage()
  await reopened.goto(`${base}/`, { timeout: 120000 })
  await reopened.waitForLoadState('networkidle').catch(() => {})
  check('admin opens / again (new tab, same session) → dashboard', await isDashboard(reopened))
  await reopened.close()
  await page.go('/?v=w')
  check('admin /?v=w → landing page', await isLanding(page))
  await page.go('/?v=d')
  check('admin /?v=d → dashboard', await isDashboard(page))
  await page.go('/collections/notes')
  check('admin /collections/notes → list', page.path().startsWith('/collections/notes') && (await has(page, 'table, .collection-list')), page.path())
  await page.go('/collections/notes/create')
  check('admin /collections/notes/create → edit view', page.path().startsWith('/collections/notes/') && (await has(page, 'form')), page.path())
  await page.go('/collections/notes/1')
  check('admin /collections/notes/1 → edit view', page.path() === '/collections/notes/1' && (await has(page, 'form')), page.path())
  await page.go('/collections/users/3')
  check('admin can open another user', page.path() === '/collections/users/3' && (await has(page, 'input[name="username"]')), page.path())
  await page.go('/globals/settings')
  check('admin /globals/settings', page.path() === '/globals/settings' && !(await isNotFound(page)), page.path())
  await page.go('/account')
  check('admin /account', page.path() === '/account' && (await has(page, 'input[name="username"]')), page.path())
  for (const p of ['/does-not-exist', '/hello-world/extra', '/collections/nope']) {
    await page.go(p)
    check(`admin ${p} → 404 page`, await isNotFound(page), page.path())
  }
  await page.go('/login')
  check('admin /login while logged in → dashboard', await isDashboard(page), page.path())
  await page.go('/hello-world')
  check('admin /hello-world → editor', await isEditor(page))
  const created = await api(page, 'POST', '/api/notes', { note: JSON.parse(lexical('Brand new admin note')) })
  check('admin REST create note', created.status === 201, `${created.status} ${created.json?.doc?.slug}`)
  if (created.json?.doc?.slug) {
    await page.go(`/${created.json.doc.slug}`)
    check('admin new note opens at /<slug>', await isEditor(page), created.json.doc.slug)
  }
  for (const [label, body, slug] of [
    ['first line "Collections" → slug collections-note', { note: JSON.parse(lexical('Collections')) }, 'collections-note'],
    ['slug "account" typed by hand → account-note', { slug: 'account' }, 'account-note'],
    ['slug "api" typed by hand → api-note', { slug: 'api' }, 'api-note'],
  ]) {
    const r = await api(page, 'POST', '/api/notes', body)
    check(`admin reserved slug: ${label}`, r.status === 201 && r.json?.doc?.slug === slug, `${r.status} ${r.json?.doc?.slug}`)
  }
  const users = await api(page, 'GET', '/api/users')
  check('admin REST list users → all', users.json?.totalDocs === 3, String(users.json?.totalDocs))
  const promote = await api(page, 'PATCH', '/api/users/2', { role: 'user' })
  const demoted = await api(page, 'GET', '/api/users/2')
  check('admin can change another user role', promote.status === 200 && demoted.json?.role === 'user', demoted.json?.role)
  await api(page, 'PATCH', '/api/users/2', { role: 'admin' })
  check('admin: no server/page errors', page.problems.length === 0, page.problems.join(' | '))
  await page.go('/logout')
  await page.waitForTimeout(2000)
  await page.go('/')
  check('admin logout → / landing page', await isLanding(page))
  await context.close()
}

async function userScenario(browser, base, config) {
  section('User role')
  const { context, page } = await persona(browser, base)
  await login(page, 'normaluser')
  check('user login → landing page (not dashboard)', (await isLanding(page)) && !(await isDashboard(page)), page.path())
  for (const p of ['/?v=d', '/collections/notes', '/collections/users/1', '/collections/notes/create', '/globals/settings', '/account']) {
    await page.go(p)
    check(`user ${p} → redirected to /`, page.path() === '/' && (await isLanding(page)), page.path())
  }
  for (const p of ['/does-not-exist', '/hello-world/extra']) {
    await page.go(p)
    check(`user ${p} → 404 page`, await isNotFound(page), page.path())
  }
  await page.go('/login')
  check('user /login while logged in → /', page.path() === '/', page.path())
  await page.go('/hello-world')
  const editor = page.locator('[contenteditable="true"]').first()
  check('user /hello-world → editor', (await editor.count()) > 0)
  if (await editor.count()) {
    await editor.click()
    await page.keyboard.type(' typed by user')
    await page.waitForTimeout(1500)
    check('user can type in the editor', (await editor.innerText()).includes('typed by user'))
    // Autosave (PATCH /api/notes/:id with the login cookie) through the Worker into D1
    const saved = await page
      .waitForSelector('[data-testid="note-save-status"][data-state="saved"]', { timeout: 30000 })
      .then(() => true, () => false)
    const status = await page.locator('[data-testid="note-save-status"]').getAttribute('data-state').catch(() => null)
    check('user autosave → "Saved"', saved, `state ${status}`)
    const row = sql(config, "SELECT slug, note FROM notes WHERE slug = 'hello-world'")
    check(
      'user autosave → content in D1, slug unchanged',
      row.length === 1 && String(row[0].note).includes('typed by user'),
      JSON.stringify(row.map((r) => r.slug)),
    )

    // Cover upload from the note page: Media upload to R2 through the Worker, set on the note in D1
    await page.locator('[data-testid="note-header"]').hover()
    await page.locator('[data-testid="add-cover"]').click()
    await page.locator('[data-testid="note-image-picker"] input[type="file"]').setInputFiles(path.join(ROOT, 'tests/fixtures/cover.png'))
    const uploaded = await page
      .waitForSelector('[data-testid="note-image-picker"]', { state: 'detached', timeout: 60000 })
      .then(() => true, () => false)
    const src = await page.locator('[data-testid="note-cover"] img').getAttribute('src').catch(() => null)
    const image = src ? await page.request.get(new URL(src, base).toString()) : null
    check(
      'user uploads a cover → served from R2',
      uploaded && image?.status() === 200 && (image.headers()['content-type'] ?? '').startsWith('image/png'),
      `${src} ${image?.status()} ${image?.headers()['content-type']}`,
    )
    const coverRow = sql(config, "SELECT cover_id FROM notes WHERE slug = 'hello-world'")
    check('user uploads a cover → notes.cover_id set in D1', Boolean(coverRow[0]?.cover_id), JSON.stringify(coverRow))
  }
  const promote = await api(page, 'PATCH', '/api/users/3', { role: 'admin' })
  const me = await api(page, 'GET', '/api/users/me')
  check('user cannot make itself admin', me.json?.user?.role === 'user', `PATCH ${promote.status}, role ${me.json?.user?.role}`)
  const other = await api(page, 'PATCH', '/api/users/1', { username: 'hacked' })
  check('user cannot edit another user', other.status === 403 || other.status === 404, String(other.status))
  const otherRead = await api(page, 'GET', '/api/users/1')
  check('user cannot read another user', otherRead.status === 403 || otherRead.status === 404, String(otherRead.status))
  const otherDelete = await api(page, 'DELETE', '/api/users/1')
  check('user cannot delete another user', otherDelete.status === 403 || otherDelete.status === 404, String(otherDelete.status))
  const create = await api(page, 'POST', '/api/users', { username: 'sneaky', password: PASSWORD, role: 'admin' })
  check('user cannot create users', create.status === 403, String(create.status))
  const list = await api(page, 'GET', '/api/users')
  check('user lists users → only itself', list.json?.totalDocs === 1, String(list.json?.totalDocs))
  const note = await api(page, 'POST', '/api/notes', {})
  check('user REST create note', note.status === 201, String(note.status))
  check('user: no server/page errors', page.problems.length === 0, page.problems.join(' | '))
  await context.close()
}

async function customViewScenario(browser, base) {
  section('Custom view (temporary /test-view)')
  const personas = [['guest', null], ['user', 'normaluser'], ['admin', 'olduser1']]
  for (const [label, username] of personas) {
    const { context, page } = await persona(browser, base)
    if (username) await login(page, username)
    for (const p of ['/test-view', '/test-view/123']) {
      await page.go(p)
      const text = (await page.locator('[data-test="test-view"]').first().innerText().catch(() => '')) || ''
      check(
        `${label} ${p} → custom view (not the note, no redirect)`,
        (await isTestView(page)) && page.path() === p && !(await page.content()).includes('Note that a custom view must hide'),
        text,
      )
    }
    check(`${label}: no server/page errors`, page.problems.length === 0, page.problems.join(' | '))
    await context.close()
  }
  const { context, page } = await persona(browser, base)
  await login(page, 'olduser1')
  const r = await api(page, 'POST', '/api/notes', { note: JSON.parse(lexical('Test view')) })
  check('new note whose slug would be "test-view" → test-view-note', r.json?.doc?.slug === 'test-view-note', r.json?.doc?.slug)
  await context.close()
}

async function firstUserScenario(browser) {
  section('First user on an empty database')
  const config = wranglerConfig('first', 8788)
  const m = migrate(config)
  check('migrations on an empty database', m.ok, m.ok ? '' : m.out.slice(-500))
  const server = await startServer(config, 8788)
  try {
    const { context, page } = await persona(browser, 'http://localhost:8788')
    await page.go('/?v=d')
    check('empty DB: /?v=d → /create-first-user', page.path().startsWith('/create-first-user'), page.path())
    await page.fill('input[name="username"]', 'firstadmin')
    await page.fill('input[name="password"]', PASSWORD)
    await page.fill('input[name="confirm-password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForSelector('.dashboard', { timeout: 60000 }).catch(() => {})
    check('first user lands on the dashboard', await isDashboard(page), page.path())
    const roles = sql(config, 'SELECT username, role FROM users')
    check('first user is admin', roles.length === 1 && roles[0].role === 'admin', JSON.stringify(roles))
    check('first user: no server/page errors', page.problems.length === 0, page.problems.join(' | '))
    await context.close()
  } finally {
    stopServer(server)
  }
}

// ------------------------------------------------------------------ main
async function main() {
  process.on('SIGINT', () => {
    cleanup()
    process.exit(130)
  })
  fs.rmSync(path.join(ROOT, '.wrangler/state'), { force: true, recursive: true })
  if (WITH_CUSTOM_VIEW) addCustomView()
  if (BUILD) {
    console.log('Building (pnpm build:cloudflare) ...')
    run('pnpm', ['run', 'build:cloudflare'])
  }
  if (!fs.existsSync(path.join(ROOT, '.open-next/worker.js'))) {
    throw new Error('No .open-next build: run `pnpm build:cloudflare` first, or pass --build')
  }

  const browser = await launch()
  try {
    const config = wranglerConfig('main', 8787)
    await migrationScenario(config)
    const server = await startServer(config, 8787)
    try {
      const base = 'http://localhost:8787'
      await guestScenario(browser, base)
      await adminScenario(browser, base)
      await userScenario(browser, base, config)
      if (WITH_CUSTOM_VIEW) await customViewScenario(browser, base)
    } finally {
      stopServer(server)
    }
    await firstUserScenario(browser)
  } finally {
    await browser.close()
  }
}

let crashed = null
try {
  await main()
} catch (error) {
  crashed = error
} finally {
  cleanup()
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log(`Failed:\n${failed.map((r) => `  - ${r.name}${r.info ? ` (${r.info})` : ''}`).join('\n')}`)
if (crashed) console.error('\nCRASHED:', crashed)
if (WITH_CUSTOM_VIEW) {
  console.log('\nNote: .open-next now contains the temporary test view; run `pnpm build:cloudflare` before deploying by hand.')
}
process.exit(failed.length || crashed ? 1 : 0)
