/*
 * Guests (no Payload login cookie) get the website pages from `src/app/(site)` instead of `src/app/(payload)`: same
 * URLs, but a light root layout without the Payload admin's client code (see src/proxy.ts and docs/bundle/AUDIT.md).
 *
 * The proxy cannot load the Payload config (too heavy to run on every request), so the first URL segments that belong
 * to Payload are listed here. tests/int/siteRoute.int.spec.ts checks this list against `getReservedSlugs(config)`, so
 * a new Payload route or custom view cannot be missed.
 */
import { DASHBOARD_VIEW, VIEW_PARAM } from './isPayloadRoute'

/** Internal prefix of the website routes (`src/app/(site)/site`). Never shown to the visitor (rewrite, not redirect). */
export const SITE_PREFIX = '/site'

/** Request header the proxy sets on the rewrite (src/proxy.ts); without it the site pages are a 404. */
export const SITE_HEADER = 'x-ink-site'

/** Payload's auth cookie (`${config.cookiePrefix}-token`, default prefix `payload`). */
export const AUTH_COOKIE = 'payload-token'

/** First URL segments that never are a note: Payload pages, the API, Next.js, and the website prefix itself. */
export const RESERVED_SEGMENTS: ReadonlySet<string> = new Set([
    // config.admin.routes (Payload 4.0.0-beta.7 defaults)
    'account',
    'browse-by-folder',
    'create-first-user',
    'forgot',
    'login',
    'logout',
    'logout-inactivity',
    'reset',
    'unauthorized',
    // built-in admin pages
    'collections',
    'globals',
    // not Payload
    '_next',
    'api',
    'site',
])

/**
 * Path inside `src/app/(site)` that renders `pathname` for a guest, or `null` when Payload renders it.
 *
 * - `/` (not `?v=d`)       -> `/site`          (landing page)
 * - `/<slug>`              -> `/site/<slug>`   (note, or the website's 404)
 * - anything else          -> `null`           (login, verify, admin pages, files...: Payload, as before)
 */
export const getGuestSitePath = (pathname: string, searchParams: URLSearchParams): null | string => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) {
        return searchParams.get(VIEW_PARAM) === DASHBOARD_VIEW ? null : SITE_PREFIX
    }
    if (segments.length !== 1) {
        return null
    }
    const [segment] = segments
    // A file (`/favicon.ico`, `/excalidraw/...` is 2+ segments) or a Payload page
    if (segment.includes('.') || RESERVED_SEGMENTS.has(segment.toLowerCase())) {
        return null
    }
    return `${SITE_PREFIX}/${segment}`
}
