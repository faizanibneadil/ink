// @vitest-environment node
import { describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { getReservedSlugs } from '@/utilities/isPayloadRoute'
import { getGuestSitePath, RESERVED_SEGMENTS, SITE_PREFIX } from '@/utilities/siteRoute'

const site = (url: string) => {
  const { pathname, searchParams } = new URL(url, 'http://localhost')
  return getGuestSitePath(pathname, searchParams)
}

describe('RESERVED_SEGMENTS (the proxy cannot read the Payload config)', () => {
  it('covers every first segment the Payload config reserves', async () => {
    const reserved = getReservedSlugs(await config)
    const missing = [...reserved].filter((segment) => !RESERVED_SEGMENTS.has(segment))
    // A Payload update or a new custom view added a route: add it to RESERVED_SEGMENTS (src/utilities/siteRoute.ts)
    expect(missing).toEqual([])
  })
})

describe('getGuestSitePath', () => {
  it('`/` is the website landing page, except `?v=d` (Payload dashboard -> login)', () => {
    expect(site('/')).toBe(SITE_PREFIX)
    expect(site('/?v=w')).toBe(SITE_PREFIX)
    expect(site('/?v=d')).toBe(null)
  })

  it('a single segment is a note', () => {
    expect(site('/my-note')).toBe('/site/my-note')
    expect(site('/my-note?x=1')).toBe('/site/my-note')
  })

  it('Payload pages, files, the API and the site prefix stay with Payload', () => {
    for (const url of [
      '/login',
      '/LOGIN',
      '/logout',
      '/forgot',
      '/reset/abc',
      '/create-first-user',
      '/account',
      '/collections/notes',
      '/globals/settings',
      '/users/verify/token',
      '/api/notes',
      '/favicon.ico',
      '/excalidraw/fonts/a.woff2',
      '/site',
      '/site/my-note',
      '/a/b',
    ]) {
      expect(site(url), url).toBe(null)
    }
  })
})
