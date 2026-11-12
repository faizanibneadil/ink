// @vitest-environment node
// Server code (Payload REST handler + MCP SDK): Node, not jsdom
import { createHash, randomBytes } from 'node:crypto'

import { REST_GET, REST_POST } from '@payloadcms/next/routes'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GET as wellKnownNotFound } from '@/app/.well-known/[...path]/route'
import { GET as wellKnownProtectedResource } from '@/app/.well-known/oauth-protected-resource/[[...path]]/route'
import config from '@/payload.config'

/*
 * MCP server (`/api/mcp`, `mcpPlugin` in src/payload.config.ts) through Payload's real REST route handler and the local database:
 * sign-in with OAuth (built-in authorization server) or an API key, admins only, notes only, no delete.
 */

const ORIGIN = 'http://localhost:3000'
const RUN = `mcp-int-${Date.now().toString(36)}`
const PASSWORD = 'mcp-int-pass-1234'
const ADMIN_KEY = `${RUN}-admin-key-0000000000`
const USER_KEY = `${RUN}-user-key-00000000000`
const REDIRECT_URI = 'http://127.0.0.1:9999/callback'
const MCP_AUTHORIZE_PATH = '/mcp/oauth/authorize'

let payload: Payload
const userIds: number[] = []
const noteIds: number[] = []

const restPost = REST_POST(config)
const restGet = REST_GET(config)

/** Calls Payload's REST route handler like Next.js does for `/api/<path>`. */
const api = (method: 'GET' | 'POST', path: string, init: { body?: string; headers?: Record<string, string> } = {}) => {
  const url = new URL(`/api${path}`, ORIGIN)
  const slug = url.pathname.replace(/^\/api\//, '').split('/')
  const request = new Request(url, { body: init.body, headers: init.headers, method, redirect: 'manual' })
  return (method === 'GET' ? restGet : restPost)(request, { params: Promise.resolve({ slug }) })
}

type Auth = { apiKey?: string; bearer?: string }
const authHeader = ({ apiKey, bearer }: Auth = {}): Record<string, string> =>
  apiKey ? { Authorization: `users API-Key ${apiKey}` } : bearer ? { Authorization: `Bearer ${bearer}` } : {}

let rpcId = 0
const rpc = async (method: string, rpcParams: Record<string, unknown>, auth?: Auth) => {
  const res = await api('POST', '/mcp', {
    body: JSON.stringify({ id: ++rpcId, jsonrpc: '2.0', method, params: rpcParams }),
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-06-18',
      ...authHeader(auth),
    },
  })
  // JSON-RPC response, an OAuth error or a Payload error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { body: (await res.json()) as any, headers: res.headers, status: res.status }
}

const toolNames = async (auth: Auth) =>
  ((await rpc('tools/list', {}, auth)).body.result.tools as { name: string }[]).map((tool) => tool.name).sort()

const callTool = async (name: string, args: Record<string, unknown>, auth: Auth = { apiKey: ADMIN_KEY }) => {
  const { body } = await rpc('tools/call', { arguments: args, name }, auth)
  return body as {
    error?: { message: string }
    result?: { content: { text: string; type: string }[]; isError?: boolean; structuredContent?: unknown }
  }
}

const heading = (text: string) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'heading',
        children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
        direction: 'ltr',
        format: '',
        indent: 0,
        tag: 'h1',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})

// ------------------------------------------------------------------ OAuth helpers

/** Browser cookie of a logged-in user (what the Allow step reads). */
const loginCookie = async (role: 'admin' | 'user') => {
  const { token } = await payload.login({
    collection: 'users',
    data: { password: PASSWORD, username: `${RUN}-${role}` },
  })
  return `payload-token=${token}`
}

/** Headers of a top-level navigation / form post inside Ink (Payload accepts the auth cookie on these). */
const browser = (cookie?: string): Record<string, string> => ({
  ...(cookie ? { Cookie: cookie } : {}),
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Site': 'same-origin',
})

const pkce = () => {
  const verifier = randomBytes(32).toString('base64url')
  return { challenge: createHash('sha256').update(verifier).digest('base64url'), verifier }
}

const registerClient = async () => {
  const res = await api('POST', '/mcp/oauth/register', {
    body: JSON.stringify({ client_name: 'Int Test Client', redirect_uris: [REDIRECT_URI] }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(201)
  return ((await res.json()) as { client_id: string }).client_id
}

const authorizeURL = (clientID: string, challenge: string) =>
  `${MCP_AUTHORIZE_PATH}?${new URLSearchParams({
    client_id: clientID,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state: 'int-state',
  })}`

const location = (res: Response) => new URL(res.headers.get('Location') ?? '', ORIGIN)

/** Register -> authorize (logged in) -> Allow / Deny -> the redirect back to the client. */
const signIn = async ({ cookie, decision = 'allow' }: { cookie: string; decision?: 'allow' | 'deny' }) => {
  const clientID = await registerClient()
  const { challenge, verifier } = pkce()
  const authorize = await api('GET', authorizeURL(clientID, challenge), { headers: browser(cookie) })
  const consent = location(authorize).searchParams.get('consent')
  expect(consent).toBeTruthy()
  const approved = await api('POST', MCP_AUTHORIZE_PATH, {
    body: new URLSearchParams({ consent: consent!, decision }).toString(),
    headers: { ...browser(cookie), 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return { callback: location(approved), clientID, verifier }
}

const token = async (form: Record<string, string>) => {
  const res = await api('POST', '/mcp/oauth/token', {
    body: new URLSearchParams(form).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return {
    body: (await res.json()) as { access_token?: string; error?: string; expires_in?: number; refresh_token?: string },
    status: res.status,
  }
}

const exchangeCode = ({ callback, clientID, verifier }: Awaited<ReturnType<typeof signIn>>) =>
  token({
    client_id: clientID,
    code: callback.searchParams.get('code')!,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  })

describe('MCP server (/api/mcp)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    for (const [role, apiKey] of [
      ['admin', ADMIN_KEY],
      ['user', USER_KEY],
    ] as const) {
      const user = await payload.create({
        collection: 'users',
        // `enableAPIKey` is a virtual field (not in the generated `User` type)
        data: { apiKey, enableAPIKey: true, password: PASSWORD, role, username: `${RUN}-${role}` } as {
          password: string
          role: typeof role
          username: string
        },
        overrideAccess: true,
      })
      userIds.push(user.id)
    }
  })

  afterAll(async () => {
    if (noteIds.length) {
      await payload.delete({ collection: 'notes', overrideAccess: true, where: { id: { in: noteIds } } })
    }
    await payload.delete({ collection: 'users', overrideAccess: true, where: { id: { in: userIds } } })
  })

  describe('signed out: the OAuth challenge', () => {
    it('answers 401 with a link to the protected resource metadata', async () => {
      const { headers, status } = await rpc('tools/list', {})
      expect(status).toBe(401)
      expect(headers.get('WWW-Authenticate')).toContain(
        `resource_metadata="${ORIGIN}/api/mcp/oauth-protected-resource"`,
      )
    })

    it('answers a wrong API key or token with 401 too', async () => {
      expect((await rpc('tools/list', {}, { apiKey: 'not-a-real-key' })).status).toBe(401)
      expect((await rpc('tools/list', {}, { bearer: 'not-a-real-token' })).status).toBe(401)
    })

    it('answers a signed-out GET with the challenge, a signed-in GET with 405 (no server-to-client stream)', async () => {
      expect((await api('GET', '/mcp')).status).toBe(401)
      expect((await api('GET', '/mcp', { headers: authHeader({ apiKey: ADMIN_KEY }) })).status).toBe(405)
    })
  })

  describe('discovery', () => {
    const expected = {
      authorization_servers: [`${ORIGIN}/api/mcp/oauth`],
      bearer_methods_supported: ['header'],
      resource: `${ORIGIN}/api/mcp`,
    }

    it('serves the protected resource metadata at the challenge link and at /.well-known', async () => {
      expect(await (await api('GET', '/mcp/oauth-protected-resource')).json()).toEqual(expected)
      for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/mcp']) {
        const res = await wellKnownProtectedResource(new Request(new URL(path, ORIGIN)))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(expected)
      }
    })

    it('serves the authorization server metadata (PKCE S256, registration, refresh tokens)', async () => {
      const res = await api('GET', '/mcp/oauth/.well-known/openid-configuration')
      expect(await res.json()).toMatchObject({
        authorization_endpoint: `${ORIGIN}/api/mcp/oauth/authorize`,
        code_challenge_methods_supported: ['S256'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        issuer: `${ORIGIN}/api/mcp/oauth`,
        registration_endpoint: `${ORIGIN}/api/mcp/oauth/register`,
        token_endpoint: `${ORIGIN}/api/mcp/oauth/token`,
      })
    })

    it('answers other /.well-known addresses with a real 404, so clients try the next address', async () => {
      for (const path of [
        '/.well-known/oauth-authorization-server/api/mcp/oauth',
        '/.well-known/openid-configuration/api/mcp/oauth',
      ]) {
        const res = await wellKnownNotFound()
        expect(res.status, path).toBe(404)
      }
    })
  })

  describe('OAuth sign-in (built-in authorization server)', () => {
    it('sends a signed-out user to the Ink login page, then back to the Allow step', async () => {
      const clientID = await registerClient()
      const res = await api('GET', authorizeURL(clientID, pkce().challenge), { headers: browser() })
      const login = location(res)
      expect(res.status).toBe(302)
      expect(login.pathname).toBe('/login')
      expect(login.searchParams.get('redirect')).toContain(MCP_AUTHORIZE_PATH)
    })

    it('a non-admin user can allow a client, but its token gets no notes tools', async () => {
      const { body } = await exchangeCode(await signIn({ cookie: await loginCookie('user') }))
      expect(await toolNames({ bearer: body.access_token })).toEqual(['getConfigInfo'])
    })

    it('admin: Deny sends access_denied back to the client', async () => {
      const { callback } = await signIn({ cookie: await loginCookie('admin'), decision: 'deny' })
      expect(callback.href.startsWith(REDIRECT_URI)).toBe(true)
      expect(callback.searchParams.get('error')).toBe('access_denied')
      expect(callback.searchParams.get('code')).toBeNull()
    })

    it('admin: Allow -> code -> tokens that work for the notes tools', async () => {
      const signedIn = await signIn({ cookie: await loginCookie('admin') })
      expect(signedIn.callback.searchParams.get('state')).toBe('int-state')

      const { body, status } = await exchangeCode(signedIn)
      expect(status).toBe(200)
      expect(body.expires_in).toBe(7200)
      expect(body.access_token).toBeTruthy()
      expect(body.refresh_token).toBeTruthy()

      expect(await toolNames({ bearer: body.access_token })).toEqual(await toolNames({ apiKey: ADMIN_KEY }))
      const info = await callTool('getConfigInfo', {}, { bearer: body.access_token })
      expect(info.result?.content[0].text).toBe('Collections: notes\nGlobals: none')

      // Only for MCP: not a login for the REST API / admin panel
      const me = await api('GET', '/users/me', { headers: { Authorization: `JWT ${body.access_token}` } })
      expect(((await me.json()) as { user: unknown }).user).toBeNull()

      // Refresh: new tokens that work
      const refreshed = await token({
        client_id: signedIn.clientID,
        grant_type: 'refresh_token',
        refresh_token: body.refresh_token!,
      })
      expect(refreshed.status).toBe(200)
      expect((await rpc('tools/list', {}, { bearer: refreshed.body.access_token })).status).toBe(200)
    })

    it('rejects a wrong PKCE verifier, and a code used twice', async () => {
      const signedIn = await signIn({ cookie: await loginCookie('admin') })
      expect((await exchangeCode({ ...signedIn, verifier: 'wrong-verifier' })).body.error).toBe('invalid_grant')
      expect((await exchangeCode(signedIn)).status).toBe(200)
      expect((await exchangeCode(signedIn)).body.error).toBe('invalid_grant')
    })

    it('never redirects to an address the client did not register', async () => {
      const clientID = await registerClient()
      const url = authorizeURL(clientID, pkce().challenge).replace(
        encodeURIComponent(REDIRECT_URI),
        encodeURIComponent('https://evil.example/cb'),
      )
      const res = await api('GET', url, { headers: browser(await loginCookie('admin')) })
      expect(location(res).origin).toBe(ORIGIN)
      expect(location(res).searchParams.get('error')).toBe('invalid-link')
    })
  })

  describe('admins only', () => {
    it('lets an admin initialize', async () => {
      const { body, status } = await rpc(
        'initialize',
        { capabilities: {}, clientInfo: { name: 'int-test', version: '1' }, protocolVersion: '2025-06-18' },
        { apiKey: ADMIN_KEY },
      )
      expect(status).toBe(200)
      expect(body.result.serverInfo.name).toBeTruthy()
    })

    it('gives a non-admin user no notes tools (only getConfigInfo, which lists nothing)', async () => {
      expect(await toolNames({ apiKey: USER_KEY })).toEqual(['getConfigInfo'])
      const info = await callTool('getConfigInfo', {}, { apiKey: USER_KEY })
      expect(info.result?.content[0].text).toBe('Collections: none\nGlobals: none')
      const find = await callTool('findDocuments', { slug: 'notes' }, { apiKey: USER_KEY })
      expect(find.error?.message ?? find.result?.content[0].text).toMatch(/not found|not enabled/)
    })
  })

  describe('exposed tools', () => {
    it('lists the notes tools and getConfigInfo, without delete', async () => {
      expect(await toolNames({ apiKey: ADMIN_KEY })).toEqual(
        [
          'countDocuments',
          'createDocuments',
          'duplicateDocument',
          'findDistinct',
          'findDocuments',
          'getCollectionSchema',
          'getConfigInfo',
          'updateDocument',
        ].sort(),
      )
    })

    // An admin can read every collection and global, so this also proves no other collection / global has MCP tools
    it('getConfigInfo shows only notes and no globals', async () => {
      const { result } = await callTool('getConfigInfo', {})
      expect(result?.content[0].text).toBe('Collections: notes\nGlobals: none')
    })

    it.each(['users', 'media', 'folders', 'tags'])('refuses the %s collection', async (slug) => {
      const { result } = await callTool('findDocuments', { slug })
      expect(result?.isError).toBe(true)
      expect(result?.content[0].text).toContain(`not enabled for collection "${slug}"`)
    })

    it('has no global or delete tools', async () => {
      expect((await callTool('updateGlobal', { data: {}, slug: 'settings' })).error?.message).toContain('not found')
      expect((await callTool('deleteDocuments', { id: 1, slug: 'notes' })).error?.message).toContain('not found')
    })
  })

  describe('notes', () => {
    it('creates a note with the slug made from its first heading (slug: "")', async () => {
      const { result } = await callTool('createDocuments', {
        documents: [{ data: { note: heading(`${RUN} Lecture One`), slug: '' } }],
        slug: 'notes',
      })
      expect(result?.isError).toBe(false)
      const id = (result?.structuredContent as { docs: { id: number }[] }).docs[0].id
      noteIds.push(id)

      const note = await payload.findByID({ collection: 'notes', id, overrideAccess: true })
      expect(note.slug).toBe(`${RUN}-lecture-one`)
    })

    it('finds, counts and updates the note', async () => {
      const [id] = noteIds
      const found = await callTool('findDocuments', { slug: 'notes', where: { id: { equals: id } } })
      expect(found.result?.content[0].text).toContain(`${RUN}-lecture-one`)

      const counted = await callTool('countDocuments', { slug: 'notes', where: { id: { equals: id } } })
      expect(counted.result?.content[0].text).toContain('contains 1 matching')

      const updated = await callTool('updateDocument', { data: { coverPosition: 25 }, id, slug: 'notes' })
      expect(updated.result?.isError).toBeFalsy()
      const note = await payload.findByID({ collection: 'notes', id, overrideAccess: true })
      expect(note.coverPosition).toBe(25)
    })
  })
})
