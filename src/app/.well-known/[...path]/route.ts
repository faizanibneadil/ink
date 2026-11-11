/*
 * Any other `/.well-known/...` address: a real 404.
 *
 * Without this, the website's catch-all page (src/app/[[...segments]]) answers these addresses with a "not found"
 * HTML page and status 200. MCP clients look for the OAuth server's metadata at several standard addresses in turn
 * (`/.well-known/oauth-authorization-server/...`, `/.well-known/openid-configuration/...`, then
 * `/api/mcp/oauth/.well-known/openid-configuration`, the one the MCP plugin serves). They only try the next address
 * after a 4xx: a 200 HTML page stops the sign-in with a JSON parse error.
 *
 * `/.well-known/oauth-protected-resource` has its own route next to this one (more specific routes win).
 */
const notFound = () =>
  Response.json({ error: 'not_found' }, { headers: { 'Cache-Control': 'no-store' }, status: 404 })

export const GET = notFound
