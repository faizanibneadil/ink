import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload, type Payload, type RequiredDataFromCollectionSlug } from 'payload'

import type { Media, Note } from '../../src/payload-types.js'
import config from '../../src/payload.config.js'

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures')

/** Fixture images in tests/fixtures */
export const FIXTURE_IMAGES = {
  cover: path.join(FIXTURES, 'cover.png'),
  icon: path.join(FIXTURES, 'icon.png'),
} as const

/** Lexical state with one heading (the note's slug is made from it) and one paragraph. */
export const noteContent = (title: string, text = 'Body text of the note.'): Note['note'] =>
  ({
    root: {
      type: 'root',
      children: [
        {
          type: 'heading',
          tag: 'h1',
          children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text: title, version: 1 }],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
          direction: null,
          format: '',
          indent: 0,
          textFormat: 0,
          textStyle: '',
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  }) as Note['note']

/** Note content: a heading, then a code block, then a paragraph. */
export const noteWithCodeBlock = (
  title: string,
  block: { code: string; filename?: string; language: string },
): Note['note'] => {
  const content = noteContent(title, 'After the code') as unknown as { root: { children: unknown[] } }
  content.root.children.splice(1, 0, { type: 'code-block', version: 1, filename: '', ...block })
  return content as unknown as Note['note']
}

/**
 * Creates notes / media through the local API for one test file and deletes everything it made in `cleanup()`.
 * Same database as the dev server Playwright starts (DATABASE_URL).
 */
export const createNoteSeeder = () => {
  let payload: Payload | undefined
  const media: number[] = []
  const notes: number[] = []

  const getClient = async () => (payload ??= await getPayload({ config }))

  return {
    /** Deletes this record too in `cleanup()` (e.g. a file the page uploaded during a test). */
    adopt(collection: 'media' | 'notes', id: number) {
      ;(collection === 'media' ? media : notes).push(id)
    },
    async cleanup() {
      const client = await getClient()
      for (const id of notes) {
        await client.delete({ collection: 'notes', id, overrideAccess: true }).catch(() => {})
      }
      for (const id of media) {
        await client.delete({ collection: 'media', id, overrideAccess: true }).catch(() => {})
      }
    },
    async media(filePath: string, alt: string): Promise<Media> {
      const doc = await (await getClient()).create({
        collection: 'media',
        data: { alt },
        filePath,
        overrideAccess: true,
      })
      media.push(doc.id)
      return doc
    },
    /** A media file from bytes (e.g. a text file or an SVG, to check they are never offered as images). */
    async mediaFromBuffer(data: Buffer, name: string, mimetype: string, alt: string): Promise<Media> {
      const doc = await (await getClient()).create({
        collection: 'media',
        data: { alt },
        file: { data, mimetype, name, size: data.length },
        overrideAccess: true,
      })
      media.push(doc.id)
      return doc
    },
    /** A note with exactly this content (e.g. from `noteWithCodeBlock`). */
    async noteWithContent(note: Note['note']): Promise<Note> {
      const doc = await (await getClient()).create({
        collection: 'notes',
        data: { note } as RequiredDataFromCollectionSlug<'notes'>,
        overrideAccess: true,
      })
      notes.push(doc.id)
      return doc
    },
    async note(
      title: string,
      data: { cover?: number; coverPosition?: number; empty?: boolean; icon?: number; text?: string } = {},
    ): Promise<Note> {
      const { empty, text, ...header } = data
      const doc = await (await getClient()).create({
        collection: 'notes',
        // `slug` is required in the type but made by the slug field from the note's first line
        // `empty`: no content at all (a new note); the slug falls back to `note-N`
        data: { note: empty ? null : noteContent(title, text), ...header } as RequiredDataFromCollectionSlug<'notes'>,
        overrideAccess: true,
      })
      notes.push(doc.id)
      return doc
    },
  }
}
