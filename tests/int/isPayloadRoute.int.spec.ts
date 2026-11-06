import type { SanitizedConfig } from 'payload'
import { describe, expect, it } from 'vitest'

import { getPayloadRouteKind, getReservedSlugs } from '@/utilities/isPayloadRoute'

// The parts of a sanitized Payload config these helpers read (Payload 4.0.0-beta.7 defaults for `admin.routes`).
const makeConfig = (views: Record<string, unknown> = {}) =>
  ({
    admin: {
      components: { views },
      routes: {
        account: '/account',
        createFirstUser: '/create-first-user',
        forgot: '/forgot',
        inactivity: '/logout-inactivity',
        login: '/login',
        logout: '/logout',
        reset: '/reset',
        unauthorized: '/unauthorized',
      },
    },
    collections: [
      { slug: 'users', auth: { tokenExpiration: 7200 } },
      { slug: 'notes', auth: false },
    ],
  }) as unknown as SanitizedConfig

const config = makeConfig()
const kind = (path: string, opts: { isAdmin?: boolean; search?: Record<string, string> } = {}) =>
  getPayloadRouteKind({
    config,
    isAdmin: opts.isAdmin,
    searchParams: opts.search,
    segments: path.split('/').filter(Boolean),
  })

describe('getPayloadRouteKind', () => {
  it('`/`: website for guests and users, dashboard for admins, `?v=` overrides', () => {
    expect(kind('/')).toBe(null)
    expect(kind('/', { isAdmin: true })).toBe('dashboard')
    expect(kind('/', { search: { v: 'd' } })).toBe('dashboard')
    expect(kind('/', { isAdmin: true, search: { v: 'w' } })).toBe(null)
    expect(kind('/', { search: { v: 'x' } })).toBe(null)
  })

  it('public Payload routes', () => {
    for (const path of ['/login', '/forgot', '/logout', '/logout-inactivity', '/create-first-user', '/unauthorized']) {
      expect(kind(path), path).toBe('public')
    }
    expect(kind('/reset/some-token')).toBe('public')
    expect(kind('/users/verify/some-token')).toBe('public')
  })

  it('admin-only Payload routes', () => {
    for (const path of ['/account', '/collections', '/collections/notes', '/collections/notes/1/versions', '/globals/settings']) {
      expect(kind(path), path).toBe('admin')
    }
  })

  it('website routes', () => {
    for (const path of ['/my-note', '/notes/verify/x', '/users/verify', '/my-note/extra', '/loginx', '/tack']) {
      expect(kind(path), path).toBe(null)
    }
  })

  it('a custom view wins over a note slug and over the website', () => {
    const withViews = makeConfig({ testView: { Component: 'x', path: '/test-view' } })
    const k = (path: string) =>
      getPayloadRouteKind({ config: withViews, segments: path.split('/').filter(Boolean) })
    expect(k('/test-view')).toBe('customView')
    expect(k('/test-view/123')).toBe('customView')
    expect(k('/test-view-note')).toBe(null)
    // Built-in routes still come first
    expect(getPayloadRouteKind({ config: makeConfig({ x: { Component: 'x', path: '/login' } }), segments: ['login'] })).toBe('public')
  })

  it('custom view options: sensitive, strict, param-only path', () => {
    const k = (views: Record<string, unknown>, path: string) =>
      getPayloadRouteKind({ config: makeConfig(views), segments: path.split('/').filter(Boolean) })
    expect(k({ v: { Component: 'x', path: '/Case', sensitive: true } }, '/case')).toBe(null)
    expect(k({ v: { Component: 'x', path: '/Case', sensitive: true } }, '/Case')).toBe('customView')
    expect(k({ v: { Component: 'x', path: '/Case' } }, '/case')).toBe('customView')
    // `/:slug` matches every one-segment URL, so it would take over all note URLs
    expect(k({ v: { Component: 'x', path: '/:slug' } }, '/any-note')).toBe('customView')
    expect(getReservedSlugs(makeConfig({ v: { Component: 'x', path: '/:slug' } })).has(':slug')).toBe(false)
  })

  it('custom views, matched like Payload (path-to-regexp)', () => {
    const withViews = makeConfig({
      reports: { Component: 'x', path: '/reports/:id' },
      exactView: { Component: 'x', exact: true, path: '/stats' },
      section: { Component: 'x', path: '/section' },
      dashboard: { Component: 'x' }, // built-in override: no path
    })
    const k = (path: string) =>
      getPayloadRouteKind({ config: withViews, segments: path.split('/').filter(Boolean) })
    expect(k('/reports/1')).toBe('customView')
    // Same as Payload's router: a param pattern only matches its own segments
    expect(k('/reports/1/details')).toBe(null)
    // A static, non-exact path also matches sub-paths
    expect(k('/section')).toBe('customView')
    expect(k('/section/a/b')).toBe('customView')
    expect(k('/sections')).toBe(null)
    expect(k('/reports')).toBe(null)
    expect(k('/stats')).toBe('customView')
    expect(k('/stats/more')).toBe(null)
    expect(k('/my-note')).toBe(null)
    expect(getReservedSlugs(withViews).has('reports')).toBe(true)
    expect(getReservedSlugs(withViews).has('stats')).toBe(true)
  })
})

describe('getReservedSlugs', () => {
  it('contains every Payload first segment plus api/_next', () => {
    const reserved = getReservedSlugs(config)
    for (const slug of [
      'account', 'collections', 'create-first-user', 'forgot', 'globals', 'login', 'logout',
      'logout-inactivity', 'reset', 'unauthorized', 'api', '_next',
    ]) {
      expect(reserved.has(slug), slug).toBe(true)
    }
    expect(reserved.has('my-note')).toBe(false)
  })
})
