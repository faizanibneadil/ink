import { pathToRegexp } from 'path-to-regexp'
import type { SanitizedConfig } from 'payload'

/*
 * The Payload admin lives at `/` (`routes.admin: '/'`), next to the website. This file decides, for a URL inside
 * `src/app/[[...segments]]`, whether Payload or the website renders it. Everything is read from the Payload config
 * (no hard-coded list), so new built-in routes, `admin.routes` overrides and custom views are picked up on their own.
 *
 * Payload 4.0.0-beta.7 admin routes (`@payloadcms/ui/dist/views/Root/getRouteData.js`):
 *   /                                      dashboard (here: `/?v=d`, or `/` for a logged-in admin)
 *   /account /create-first-user /forgot /login /logout /logout-inactivity /unauthorized   (`config.admin.routes`)
 *   /reset/:token                          (`config.admin.routes.reset`)
 *   /:authCollectionSlug/verify/:token
 *   /collections/...  /globals/...
 *   custom views                           (`config.admin.components.views[*].path`)
 */

/** `?v=d` opens the Payload dashboard, `?v=w` the website. */
export const VIEW_PARAM = 'v'
export const DASHBOARD_VIEW = 'd'
export const WEBSITE_VIEW = 'w'

/**
 * - `dashboard`: Payload dashboard (`/`)
 * - `public`:    Payload pages that work without an admin login (login, forgot / reset password, logout, verify ...)
 * - `admin`:     every other built-in Payload page (collections, globals, account): admins only
 * - `customView`: a custom view (`config.admin.components.views`). Rendered for everyone, as in Payload itself: the
 *                 view decides on its own whether it needs a logged-in user. Checked before any note lookup.
 * - `null`:      not Payload: the website renders it (`/<noteSlug>` or 404)
 */
export type PayloadRouteKind = 'admin' | 'customView' | 'dashboard' | 'public' | null

type SearchParams = Record<string, string | string[] | undefined> | undefined

/** `config.admin.routes` keys Payload lets in without admin access (see `isPublicAdminRoute` in @payloadcms/ui). */
const PUBLIC_ADMIN_ROUTE_KEYS = [
  'createFirstUser',
  'forgot',
  'inactivity',
  'login',
  'logout',
  'reset',
  'unauthorized',
] as const

/** Route prefixes Payload always renders (`/collections/...`, `/globals/...`). */
const ADMIN_ROUTE_SEGMENTS = ['collections', 'globals'] as const

/** Paths outside the Payload admin that a note slug must never use. */
const NON_ADMIN_RESERVED_SEGMENTS = ['api', '_next'] as const

const firstSegment = (path: string | undefined): string | undefined =>
  path?.split('/').filter(Boolean)[0]

const getParam = (searchParams: SearchParams, name: string): string | undefined => {
  const value = searchParams?.[name]
  return Array.isArray(value) ? value[0] : value
}

/** `config.admin.routes` as `{ key: firstSegment }`, e.g. `{ login: 'login', reset: 'reset' }`. */
const getAdminRouteSegments = (config: SanitizedConfig): Record<string, string> => {
  const segments: Record<string, string> = {}
  for (const [key, route] of Object.entries(config.admin?.routes ?? {})) {
    const segment = typeof route === 'string' ? firstSegment(route) : undefined
    if (segment) {
      segments[key] = segment
    }
  }
  return segments
}

/**
 * Same matching as Payload's own router (`isPathMatchingRoute` in @payloadcms/ui, `path-to-regexp@6`), so a URL is
 * a custom view here exactly when Payload would render that custom view.
 */
export const isPathMatchingView = ({
  exact,
  path: viewPath,
  pathname,
  sensitive,
  strict,
}: {
  exact?: boolean
  path?: string
  pathname: string
  sensitive?: boolean
  strict?: boolean
}): boolean => {
  if (!viewPath) {
    return false
  }
  const stripTrailingSlash = (value: string) => (value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value)
  const route = strict ? pathname : stripTrailingSlash(pathname)
  const match = pathToRegexp(viewPath, [], { sensitive, strict }).exec(route)
  const viewRoute = strict ? match?.[0] || viewPath : stripTrailingSlash(match?.[0] || viewPath)

  if (exact) {
    return route === viewRoute
  }
  if (!route.startsWith(viewRoute)) {
    return false
  }
  const rest = route.slice(viewRoute.length)
  return rest === '' || rest.startsWith('/')
}

/** Custom views from `config.admin.components.views` that have their own path (built-in overrides have none). */
const getCustomViews = (config: SanitizedConfig) =>
  Object.values(config.admin?.components?.views ?? {}).filter(
    (view): view is NonNullable<typeof view> & { path: `/${string}` } =>
      Boolean(view && typeof view.path === 'string' && view.path !== '/'),
  )

/**
 * Which kind of Payload page (if any) `segments` + `searchParams` point to.
 *
 * `isAdmin` is only used for `/` without `?v=`: a logged-in admin gets the dashboard, everyone else the website.
 */
export const getPayloadRouteKind = ({
  config,
  isAdmin = false,
  searchParams,
  segments = [],
}: {
  config: SanitizedConfig
  isAdmin?: boolean
  searchParams?: SearchParams
  segments?: string[]
}): PayloadRouteKind => {
  if (segments.length === 0) {
    const view = getParam(searchParams, VIEW_PARAM)
    if (view === DASHBOARD_VIEW) {
      return 'dashboard'
    }
    if (view === WEBSITE_VIEW) {
      return null
    }
    return isAdmin ? 'dashboard' : null
  }

  const [segmentOne] = segments
  const adminRouteSegments = getAdminRouteSegments(config)

  // /login, /forgot, /reset/:token, /logout ... (and `/account`, which needs an admin)
  for (const [key, segment] of Object.entries(adminRouteSegments)) {
    if (segment === segmentOne) {
      return (PUBLIC_ADMIN_ROUTE_KEYS as readonly string[]).includes(key) ? 'public' : 'admin'
    }
  }

  // /:authCollectionSlug/verify/:token
  if (
    segments.length === 3 &&
    segments[1] === 'verify' &&
    config.collections.some((collection) => collection.slug === segmentOne && Boolean(collection.auth))
  ) {
    return 'public'
  }

  // /collections/..., /globals/...
  if ((ADMIN_ROUTE_SEGMENTS as readonly string[]).includes(segmentOne)) {
    return 'admin'
  }

  // Custom views (before the website, so `/<noteSlug>` never shadows one)
  const pathname = `/${segments.join('/')}`
  const isCustomView = getCustomViews(config).some((view) =>
    isPathMatchingView({
      exact: view.exact,
      path: view.path,
      pathname,
      sensitive: view.sensitive,
      strict: view.strict,
    }),
  )

  return isCustomView ? 'customView' : null
}

/**
 * First URL segments that belong to Payload (or Next.js / the API), so a note slug can never use them
 * (`/<noteSlug>` would be shadowed by the Payload page).
 */
export const getReservedSlugs = (config: SanitizedConfig): Set<string> => {
  const reserved = new Set<string>([
    ...Object.values(getAdminRouteSegments(config)),
    ...ADMIN_ROUTE_SEGMENTS,
    ...NON_ADMIN_RESERVED_SEGMENTS,
  ])
  for (const view of getCustomViews(config)) {
    const segment = firstSegment(view.path)
    // A view like `/:slug` has no fixed first segment; it matches everything and cannot be reserved.
    if (segment && !segment.startsWith(':')) {
      reserved.add(segment.toLowerCase())
    }
  }
  return reserved
}
