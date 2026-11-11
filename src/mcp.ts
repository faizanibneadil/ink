import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { filterMCPItems } from '@payloadcms/plugin-mcp/internal'
import type { MCPPluginConfig, SanitizedMCPPluginConfig } from '@payloadcms/plugin-mcp'
import { Forbidden, UnauthorizedError } from 'payload'

import { isAdminUser } from './collections/Users'

/**
 * MCP server at `POST /api/mcp` (Payload MCP plugin) so AI clients (Claude, Cursor, ...) can work with notes.
 *
 * - Who: admins only. Clients authenticate with a user's API key, `Authorization: users API-Key <key>` (enable it on
 *   the user's page in the admin). No key / wrong key -> 401, a non-admin user -> 403.
 * - What: only the `notes` collection, without delete. Every other collection (users, media, ...) and the `settings`
 *   global are not exposed at all. `getConfigInfo` (lists what this client can use) stays.
 * - Payload access control still applies to every tool call (the tools run with the API key's user).
 */
export const MCP_COLLECTIONS = ['notes'] as const

type MCPItem = SanitizedMCPPluginConfig['items'][number]

/** Built-in MCP tool that stays available besides the collection tools. */
const MCP_TOP_LEVEL_TOOLS = ['getConfigInfo']

/** Keeps only the MCP items this project exposes (see above). */
export const isExposedMCPItem = (item: MCPItem): boolean => {
  switch (item.type) {
    case 'collectionTool':
      return (MCP_COLLECTIONS as readonly string[]).includes(item.collectionSlug)
    case 'tool':
      return MCP_TOP_LEVEL_TOOLS.includes(item.configKey)
    default:
      // No globals, prompts or resources are exposed.
      return false
  }
}

/**
 * Same authentication as the plugin's default (`getAuthorizedMCP`), plus: the caller must be a logged-in admin, and
 * only the exposed items are returned.
 */
export const getAuthorizedMCP: NonNullable<MCPPluginConfig['overrideGetAuthorizedMCP']> = async ({
  overrideAccess,
  pluginConfig,
  req,
}) => {
  if (req.headers) {
    const headers = new Headers(req.headers)
    // Header auth only (API key / JWT): never fall back to an auto-login user.
    headers.set('DisableAutologin', 'true')
    req.user = (await req.payload.auth({ headers, req })).user
  }

  if (!req.user) {
    throw new UnauthorizedError(req.t)
  }
  if (!isAdminUser(req.user)) {
    throw new Forbidden(req.t)
  }

  return {
    items: await filterMCPItems({
      items: pluginConfig.items.filter(isExposedMCPItem),
      overrideAccess,
      req,
    }),
    overrideAccess,
  }
}

export const mcp = mcpPlugin({
  collections: {
    notes: {
      tools: {
        // The MCP input schema marks `slug` as required, but the app makes it from the note's first heading /
        // paragraph (src/collections/note-slug.ts) when it is empty: tell the client to send "".
        create: {
          description:
            'Create one or more notes. `note` is a Lexical rich-text JSON document (call getCollectionSchema with slug ' +
            '"notes" for its shape). Send `slug: ""` to make the URL slug from the note\'s first heading / paragraph ' +
            '(the note is shown at `/<slug>`), or a slug of your own.',
        },
        delete: false,
      },
    },
  },
  mcp: {
    serverOptions: {
      serverInfo: { name: 'Ink', version: '1.0.0' },
    },
  },
  overrideGetAuthorizedMCP: getAuthorizedMCP,
})
