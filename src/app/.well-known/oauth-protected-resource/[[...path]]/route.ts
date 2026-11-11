import config from '@payload-config'
import { oauthProtectedResourceHandler } from '@payloadcms/plugin-mcp'

/*
 * OAuth Protected Resource Metadata (RFC 9728) for the MCP server, at the site root:
 * `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/api/mcp`.
 *
 * Tells MCP clients (Claude, Cursor, ...) which authorization server signs users in for `/api/mcp` (Ink's own, from
 * the MCP plugin, see src/mcp.ts). The `401` from `/api/mcp` already links to `/api/mcp/oauth-protected-resource`;
 * this is for clients that only look at the standard address.
 */
export const GET = oauthProtectedResourceHandler({ config })
