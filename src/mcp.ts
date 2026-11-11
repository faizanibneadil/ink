import { mcpPlugin } from '@payloadcms/plugin-mcp'
import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'
import { definePlugin, type CollectionConfig, type Endpoint, type GlobalConfig } from 'payload'

import { isAdminUser } from './collections/Users'

/**
 * MCP server at `/api/mcp` (Payload MCP plugin) so AI clients (Claude, Cursor, Codex, ...) can work with notes.
 *
 * Sign-in, either of:
 * - OAuth (built-in authorization server of the plugin): the client only needs the URL. It sends the user to Ink,
 *   the user logs in and clicks Allow on `/mcp/authorize`, and the client gets an access token + refresh token.
 * - A user's API key: `Authorization: users API-Key <key>` (Users -> "API Key" in the admin).
 *
 * Who / what:
 * - Admins only: only an admin can allow an MCP client (OAuth), and only an admin gets the notes tools.
 * - Only the `notes` collection, without delete. The tools of every other collection (users, media, ...) and of every
 *   global are turned off. `getConfigInfo` (lists what this client can use) stays.
 * - Payload access control still applies to every tool call (the tools run as the signed-in user).
 */
export const MCP_COLLECTIONS = ['notes'] as const

/** Built-in collection tools of `@payloadcms/plugin-mcp` (its `MCPCollectionBuiltinName`). */
const COLLECTION_TOOLS = [
  'count',
  'countVersions',
  'create',
  'delete',
  'duplicate',
  'find',
  'findDistinct',
  'findVersionByID',
  'findVersions',
  'getCollectionSchema',
  'getUploadInstructions',
  'restoreVersion',
  'update',
] as const

/** Built-in global tools of `@payloadcms/plugin-mcp` (its `MCPGlobalBuiltinName`). */
const GLOBAL_TOOLS = [
  'countGlobalVersions',
  'find',
  'findGlobalVersionByID',
  'findGlobalVersions',
  'getGlobalSchema',
  'restoreGlobalVersion',
  'update',
] as const

/** Notes tools that stay turned off. */
const DISABLED_NOTES_TOOLS = ['delete'] as const

const adminOnly = ({ req }: { req: { user?: unknown } }) => isAdminUser(req.user)

const allOff = <T extends string>(tools: readonly T[]) =>
  Object.fromEntries(tools.map((tool) => [tool, false])) as Record<T, false>

const notesTools = () => {
  const tools: Record<string, false | { access: typeof adminOnly; description?: string }> = {}
  for (const tool of COLLECTION_TOOLS) {
    tools[tool] = (DISABLED_NOTES_TOOLS as readonly string[]).includes(tool) ? false : { access: adminOnly }
  }
  // The MCP input schema marks `slug` as required, but the app makes it from the note's first heading / paragraph
  // (src/collections/note-slug.ts) when it is empty: tell the client to send "".
  tools.create = {
    access: adminOnly,
    description:
      'Create one or more notes. `note` is a Lexical rich-text JSON document (call getCollectionSchema with slug ' +
      '"notes" for its shape). Send `slug: ""` to make the URL slug from the note\'s first heading / paragraph ' +
      '(the note is shown at `/<slug>`), or a slug of your own.',
  }
  return tools
}

/** The `mcpPlugin` options for the app's collections and globals. */
export const getMCPOptions = ({
  collections,
  globals,
}: {
  collections: Pick<CollectionConfig, 'slug'>[]
  globals: Pick<GlobalConfig, 'slug'>[]
}): MCPPluginConfig => ({
  collections: Object.fromEntries(
    collections.map(({ slug }) => [
      slug,
      { tools: (MCP_COLLECTIONS as readonly string[]).includes(slug) ? notesTools() : allOff(COLLECTION_TOOLS) },
    ]),
  ) as MCPPluginConfig['collections'],
  globals: Object.fromEntries(
    globals.map(({ slug }) => [slug, { tools: allOff(GLOBAL_TOOLS) }]),
  ) as MCPPluginConfig['globals'],
  mcp: {
    serverOptions: {
      serverInfo: { name: 'Ink', version: '1.0.0' },
    },
  },
  // The plugin is its own OAuth authorization server (users log in to Ink and click Allow).
  oauth: { type: 'builtin' },
})

/** The OAuth Allow step (`GET` opens the Allow page, `POST` is the Allow / Deny click). */
export const MCP_AUTHORIZE_PATH = '/mcp/oauth/authorize'

export const MCP_ADMINS_ONLY_MESSAGE = 'Only Ink admins can connect AI apps (MCP clients). Log in with an admin account.'

/**
 * Only admins can allow an MCP client: a logged-in non-admin gets `403` on the Allow step, so no token is ever issued
 * to them. (Not logged in: the plugin sends the user to the login page first, then back here.)
 */
export const restrictMCPAuthorizeToAdmins = (endpoint: Endpoint): Endpoint => {
  if (endpoint.path !== MCP_AUTHORIZE_PATH) {
    return endpoint
  }
  const { handler } = endpoint
  return {
    ...endpoint,
    handler: (req) => {
      if (req.user && !isAdminUser(req.user)) {
        return new Response(MCP_ADMINS_ONLY_MESSAGE, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          status: 403,
        })
      }
      return handler(req)
    },
  }
}

/** Runs after the MCP plugin (order 10) and wraps its Allow endpoints. */
const mcpAdminsOnly = definePlugin({
  slug: 'ink-mcp-admins-only',
  order: 11,
  plugin: ({ config }) => ({
    ...config,
    endpoints: (config.endpoints ?? []).map(restrictMCPAuthorizeToAdmins),
  }),
})

export const mcp = (args: Parameters<typeof getMCPOptions>[0]) => [mcpPlugin(getMCPOptions(args)), mcpAdminsOnly()]
