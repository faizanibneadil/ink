/*
 * One catch-all route for both the Payload admin (`routes.admin: '/'`) and the website.
 * Started from Payload's generated admin page (`@payloadcms/next/views`); now maintained by hand.
 *
 *   /                 website landing page (guests, `user` role, admins with `?v=w`)
 *   / (logged-in admin), /?v=d    Payload dashboard
 *   /login, /forgot, /reset/:token, /logout, /<authCollection>/verify/:token ...   Payload (no admin needed)
 *   /collections/..., /globals/..., /account                                      Payload, admins only
 *   custom views (`config.admin.components.views`)   Payload, for everyone (the view handles its own auth).
 *                     Checked before notes: a custom view path always wins over a note slug.
 *   /<noteSlug>       the note: editor for logged-in users, read-only for guests
 *   anything else     404
 *
 * A logged-in non-admin who opens an admins-only Payload page is redirected to `/`.
 * Guests opening one get Payload's own redirect to `/login`.
 */
import configPromise from '@payload-config'
import { RootPage as PayloadPage, generatePageMetadata as generatePayloadPageMetadata } from '@payloadcms/next/views'
import type { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'

import { getNoteFirstLine } from '@/collections/note-slug'
import { isAdminUser } from '@/collections/Users'
import type { Note as NoteType, User } from '@/payload-types'
import { getPayloadRouteKind } from '@/utilities/isPayloadRoute'
import { Editor } from '@/views/editor'
import { getNoteHeaderData } from '@/views/note-header/header-data'
import { NoteViewer } from '@/views/note-viewer'

import { importMap } from '../importMap'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

/** Logged-in user of this request (shared by `generateMetadata` and the page). */
const getUser = cache(async (): Promise<User | null> => {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await getHeaders() })
  return (user as User | null) ?? null
})

/** Note shown at `/<slug>` (shared by `generateMetadata` and the page). */
const getNote = cache(async (slug: string): Promise<NoteType | null> => {
  const payload = await getPayload({ config: configPromise })
  const user = await getUser()
  const { docs } = await payload.find({
    collection: 'notes',
    depth: 1,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    user,
    where: { slug: { equals: slug } },
  })
  return docs[0] ?? null
})

const resolveRoute = async (props: Args) => {
  const [params, searchParams, config, user] = await Promise.all([
    props.params,
    props.searchParams,
    configPromise,
    getUser(),
  ])
  const segments = params?.segments ?? []
  const isAdmin = isAdminUser(user)
  const kind = getPayloadRouteKind({ config, isAdmin, searchParams, segments })
  return { isAdmin, kind, segments, user }
}

export const generateMetadata = async (props: Args): Promise<Metadata> => {
  const { isAdmin, kind, segments, user } = await resolveRoute(props)

  if (kind === 'public' || kind === 'customView' || ((kind === 'admin' || kind === 'dashboard') && (isAdmin || !user))) {
    return generatePayloadPageMetadata({ config: configPromise, ...props })
  }

  if (!kind && segments.length === 1) {
    const note = await getNote(segments[0])
    if (note) {
      return { title: getNoteFirstLine(note.note) || note.slug || 'Note' }
    }
  }

  return { title: 'Website Lending Page' }
}

export default async function Page(props: Args) {
  const { isAdmin, kind, segments, user } = await resolveRoute(props)

  if (kind === 'admin' || kind === 'dashboard') {
    // Logged in, but not an admin: the Payload admin is not for them.
    if (user && !isAdmin) {
      redirect('/')
    }
    return PayloadPage({ config: configPromise, ...props, importMap })
  }

  if (kind === 'public' || kind === 'customView') {
    return PayloadPage({ config: configPromise, ...props, importMap })
  }

  if (segments.length === 0) {
    return <div>Website Lending Page</div>
  }

  if (segments.length === 1) {
    const note = await getNote(segments[0])
    if (!note) {
      notFound()
    }
    if (user) {
      return <Editor key={note.id} id={note.id} note={note.note} user={user} />
    }
    // Reading layout (width, padding, responsive sizing) lives in note-viewer.css; the cover / icon header in
    // note-header.css. Only plain header values (URL, alt, size) go to the client, not the whole media documents.
    return <NoteViewer header={getNoteHeaderData(note)} note={note.note} />
  }

  notFound()
}
