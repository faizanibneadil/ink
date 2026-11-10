/*
 * Guest website (src/proxy.ts rewrites guests from `/` and `/<slug>` to here, under `/site`):
 *
 *   /site          landing page        (served at `/`)
 *   /site/<slug>   the note, read-only (served at `/<slug>`)
 *
 * Same output as the guest branch of src/app/(payload)/[[...segments]]/page.tsx, without Payload's RootLayout. Opened
 * directly (`/site/...`, no proxy header), it is a 404.
 */
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { getNoteFirstLine } from '@/collections/note-slug'
import { SITE_HEADER } from '@/utilities/siteRoute'
import { findNoteBySlug } from '@/views/note-data'
import { getNoteHeaderData } from '@/views/note-header/header-data'
import { NoteViewer } from '@/views/note-viewer'

type Args = {
  params: Promise<{ segments?: string[] }>
}

/** The page the request is for, or `null` (404): only reached through the proxy, landing or a single slug. */
const resolve = async ({ params }: Args): Promise<null | { slug?: string }> => {
  const [{ segments = [] }, headerList] = await Promise.all([params, headers()])
  if (headerList.get(SITE_HEADER) !== '1' || segments.length > 1) {
    return null
  }
  return { slug: segments[0] }
}

/** Guest view of the note (shared by `generateMetadata` and the page). */
const getNote = cache((slug: string) => findNoteBySlug(slug, null))

export const generateMetadata = async (props: Args): Promise<Metadata> => {
  const page = await resolve(props)
  if (page?.slug) {
    const note = await getNote(page.slug)
    if (note) {
      return { title: getNoteFirstLine(note.note) || note.slug || 'Note' }
    }
  }
  return { title: 'Website Lending Page' }
}

export default async function SitePage(props: Args) {
  const page = await resolve(props)
  if (!page) {
    notFound()
  }
  if (!page.slug) {
    return <div>Website Lending Page</div>
  }
  const note = await getNote(page.slug)
  if (!note) {
    notFound()
  }
  // Reading layout in note-viewer.css; header in note-header.css. Only plain header values go to the client.
  return <NoteViewer header={getNoteHeaderData(note)} note={note.note} />
}
