// @vitest-environment node
// Server code (Payload REST handler + MCP SDK): Node, not jsdom
import { REST_GET, REST_POST } from '@payloadcms/next/routes'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

/*
 * MCP server (`/api/mcp`, src/mcp.ts) through Payload's real REST route handler and the local database:
 * admins only (API key), notes only, no delete.
 */

const RUN = `mcp-int-${Date.now().toString(36)}`
const ADMIN_KEY = `${RUN}-admin-key-0000000000`
const USER_KEY = `${RUN}-user-key-00000000000`

let payload: Payload
const userIds: number[] = []
const noteIds: number[] = []

const post = REST_POST(config)
const get = REST_GET(config)
const params = { params: Promise.resolve({ slug: ['mcp'] }) }

let rpcId = 0
const rpc = async (method: string, rpcParams: Record<string, unknown>, apiKey?: string) => {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2025-06-18',
  }
  if (apiKey) {
    headers.Authorization = `users API-Key ${apiKey}`
  }
  const res = await post(
    new Request('http://localhost:3000/api/mcp', {
      body: JSON.stringify({ id: ++rpcId, jsonrpc: '2.0', method, params: rpcParams }),
      headers,
      method: 'POST',
    }),
    params,
  )
  // JSON-RPC response (or a Payload error)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { body: (await res.json()) as any, status: res.status }
}

const callTool = async (name: string, args: Record<string, unknown>, apiKey = ADMIN_KEY) => {
  const { body } = await rpc('tools/call', { arguments: args, name }, apiKey)
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
        data: { apiKey, enableAPIKey: true, password: 'mcp-int-pass-1234', role, username: `${RUN}-${role}` } as {
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

  describe('authentication', () => {
    it('rejects a request without an API key (401)', async () => {
      const { status } = await rpc('tools/list', {})
      expect(status).toBe(401)
    })

    it('rejects a wrong API key (401)', async () => {
      const { status } = await rpc('tools/list', {}, 'not-a-real-key')
      expect(status).toBe(401)
    })

    it('rejects a non-admin user (403)', async () => {
      const { status } = await rpc('tools/list', {}, USER_KEY)
      expect(status).toBe(403)
    })

    it('answers GET with 405 (no server-to-client stream)', async () => {
      const res = await get(new Request('http://localhost:3000/api/mcp'), params)
      expect(res.status).toBe(405)
    })

    it('lets an admin initialize', async () => {
      const { body, status } = await rpc(
        'initialize',
        { capabilities: {}, clientInfo: { name: 'int-test', version: '1' }, protocolVersion: '2025-06-18' },
        ADMIN_KEY,
      )
      expect(status).toBe(200)
      expect(body.result.serverInfo.name).toBe('Ink')
    })
  })

  describe('exposed tools', () => {
    it('lists the notes tools and getConfigInfo, without delete', async () => {
      const { body } = await rpc('tools/list', {}, ADMIN_KEY)
      const names = (body.result.tools as { name: string }[]).map((tool) => tool.name).sort()
      expect(names).toEqual(
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
