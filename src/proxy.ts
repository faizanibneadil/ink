import { type NextRequest, NextResponse } from 'next/server'

import { AUTH_COOKIE, getGuestSitePath, SITE_HEADER } from '@/utilities/siteRoute'

/*
 * Guests (no Payload login cookie) get the website pages (landing `/`, notes `/<slug>`) from `src/app/(site)`: a light
 * root layout without the Payload admin's JavaScript. Same URL (rewrite, not redirect).
 *
 * This is only a routing choice, not access control: the site page reads notes as a guest (`overrideAccess: false`,
 * no user), and a stale / invalid cookie just falls back to the Payload route, which still renders the guest view.
 */
export function proxy(request: NextRequest) {
    if (request.cookies.has(AUTH_COOKIE)) {
        return NextResponse.next()
    }
    const sitePath = getGuestSitePath(request.nextUrl.pathname, request.nextUrl.searchParams)
    if (!sitePath) {
        return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    url.pathname = sitePath
    // Marks the rewrite: the site pages are not reachable at `/site/...` directly
    const headers = new Headers(request.headers)
    headers.set(SITE_HEADER, '1')
    return NextResponse.rewrite(url, { request: { headers } })
}

export const config = {
    // Pages only: not the API, Next.js assets or files with an extension
    matcher: ['/((?!api/|_next/|.*\\..*).*)'],
}
