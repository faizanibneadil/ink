// @vitest-environment node
// Server code (Payload local API, uploads): Node, not jsdom (file type detection needs Node's own Buffer)
import { getPayload, type Payload, type RequiredDataFromCollectionSlug } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  COVER_POSITION_DEFAULT,
  normalizeCoverPosition,
} from '@/collections/note-header'
import config from '@/payload.config'
import type { Media, Note, User } from '@/payload-types'

/*
 * Notes: cover photo, icon and cover position (Notion-style page header), and how they show up in the admin.
 * Real local database + real uploads (written to the local `media/` folder and removed again).
 */

// 1×1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const RUN = `notes-int-${Date.now()}`

let payload: Payload
let admin: User
const mediaIds: number[] = []
const noteIds: number[] = []

const lexical = (text: string) => ({
  root: {
    type: 'root',
    children: [
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
})

const createMedia = async (name: string, data: Buffer, mimetype: string): Promise<Media> => {
  const doc = await payload.create({
    collection: 'media',
    data: { alt: name },
    file: { data, mimetype, name, size: data.length },
    overrideAccess: true,
  })
  mediaIds.push(doc.id)
  return doc
}

const createNote = async (
  text: string,
  data: { cover?: number; coverPosition?: number; icon?: number } = {},
): Promise<Note> => {
  const doc = await payload.create({
    collection: 'notes',
    // `slug` is required in the type but made by the slug field from the note's first line
    data: { note: lexical(text) as Note['note'], ...data } as RequiredDataFromCollectionSlug<'notes'>,
    overrideAccess: true,
  })
  noteIds.push(doc.id)
  return doc
}

const idOf = (value: unknown): unknown =>
  value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value

describe('Notes: cover, icon, cover position', () => {
  let image: Media
  let image2: Media
  let textFile: Media
  let svgFile: Media

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    admin = (await payload.create({
      collection: 'users',
      data: { email: `${RUN}@example.com`, password: 'test1234', role: 'admin', username: RUN },
      overrideAccess: true,
    })) as User
    image = await createMedia(`${RUN}-a.png`, PNG, 'image/png')
    image2 = await createMedia(`${RUN}-b.png`, PNG, 'image/png')
    // Media accepts images only now; a text file / SVG can only be an older row from before that: simulate one
    const legacy = async (name: string, mimeType: string) => {
      const doc = await createMedia(`${RUN}-${name}.png`, PNG, 'image/png')
      await payload.db.updateOne({ collection: 'media', data: { mimeType }, id: doc.id, req: undefined })
      return { ...doc, mimeType }
    }
    textFile = await legacy('text', 'text/plain')
    svgFile = await legacy('svg', 'image/svg+xml')
  })

  afterAll(async () => {
    for (const id of noteIds) {
      await payload.delete({ collection: 'notes', id, overrideAccess: true }).catch(() => {})
    }
    for (const id of mediaIds) {
      await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => {})
    }
    if (admin) {
      await payload.delete({ collection: 'users', id: admin.id, overrideAccess: true }).catch(() => {})
    }
  })

  it('admin: slug is the title, icon is the thumbnail', () => {
    const notes = payload.collections.notes.config
    expect(notes.admin.useAsTitle).toBe('slug')
    expect(notes.admin.useAsThumbnail).toBe('icon')
  })

  it('cover and icon are uploads to media, only images', () => {
    const fields = payload.collections.notes.config.flattenedFields
    for (const name of ['cover', 'icon']) {
      const field = fields.find((f) => f.name === name)
      expect(field?.type).toBe('upload')
      expect(field && 'relationTo' in field ? field.relationTo : undefined).toBe('media')
    }
  })

  it('new note: no cover / icon, cover position in the middle', async () => {
    const note = await createNote(`${RUN} plain`)
    expect(note.cover ?? null).toBeNull()
    expect(note.icon ?? null).toBeNull()
    expect(note.coverPosition).toBe(COVER_POSITION_DEFAULT)
  })

  it('saves cover, icon and position, and populates them as media', async () => {
    const note = await createNote(`${RUN} with header`, { cover: image.id, coverPosition: 20, icon: image2.id })
    const found = await payload.findByID({ collection: 'notes', depth: 1, id: note.id, overrideAccess: true })
    expect(idOf(found.cover)).toBe(image.id)
    expect(idOf(found.icon)).toBe(image2.id)
    expect(found.coverPosition).toBe(20)
    // What the page uses to render the images
    expect(typeof found.cover === 'object' && found.cover?.url).toBeTruthy()
    expect(typeof found.cover === 'object' && found.cover?.mimeType).toBe('image/png')
  })

  it('rejects a non-image file or an SVG (older media rows) as cover or icon', async () => {
    const note = await createNote(`${RUN} non image`)
    for (const file of [textFile, svgFile]) {
      await expect(
        payload.update({ collection: 'notes', data: { cover: file.id }, id: note.id, overrideAccess: true }),
      ).rejects.toThrow()
      await expect(
        payload.update({ collection: 'notes', data: { icon: file.id }, id: note.id, overrideAccess: true }),
      ).rejects.toThrow()
    }
    const found = await payload.findByID({ collection: 'notes', depth: 0, id: note.id, overrideAccess: true })
    expect(found.cover ?? null).toBeNull()
    expect(found.icon ?? null).toBeNull()
  })

  it('rejects a cover position outside 0–100', async () => {
    const note = await createNote(`${RUN} position`)
    for (const coverPosition of [-1, 101]) {
      await expect(
        payload.update({ collection: 'notes', data: { coverPosition }, id: note.id, overrideAccess: true }),
      ).rejects.toThrow()
    }
  })

  it('a guest cannot change the cover or icon', async () => {
    const note = await createNote(`${RUN} guest`)
    await expect(
      payload.update({ collection: 'notes', data: { cover: image.id }, id: note.id, overrideAccess: false, user: null }),
    ).rejects.toThrow()
    const found = await payload.findByID({ collection: 'notes', depth: 0, id: note.id, overrideAccess: true })
    expect(found.cover ?? null).toBeNull()
  })

  it('a logged-in user can change the cover, icon and position', async () => {
    const note = await createNote(`${RUN} logged in`)
    const updated = await payload.update({
      collection: 'notes',
      data: { cover: image.id, coverPosition: 75, icon: image2.id },
      depth: 0,
      id: note.id,
      overrideAccess: false,
      user: admin,
    })
    expect(updated.cover).toBe(image.id)
    expect(updated.icon).toBe(image2.id)
    expect(updated.coverPosition).toBe(75)
  })

  it('the slug (the note URL) does not change when the header or the content changes', async () => {
    const note = await createNote(`${RUN} stable slug`)
    const slug = note.slug
    expect(slug).toBeTruthy()
    const afterHeader = await payload.update({
      collection: 'notes',
      data: { cover: image.id, icon: image2.id },
      id: note.id,
      overrideAccess: true,
    })
    expect(afterHeader.slug).toBe(slug)
    const afterContent = await payload.update({
      collection: 'notes',
      data: { note: lexical(`${RUN} a completely different first line`) as Note['note'] },
      id: note.id,
      overrideAccess: true,
    })
    expect(afterContent.slug).toBe(slug)
  })

  it('deleting the media clears the cover / icon instead of failing', async () => {
    const own = await createMedia(`${RUN}-delete.png`, PNG, 'image/png')
    const note = await createNote(`${RUN} delete media`, { cover: own.id, icon: own.id })
    await payload.delete({ collection: 'media', id: own.id, overrideAccess: true })
    const found = await payload.findByID({ collection: 'notes', depth: 1, id: note.id, overrideAccess: true })
    expect(found.cover ?? null).toBeNull()
    expect(found.icon ?? null).toBeNull()
  })
})

describe('normalizeCoverPosition', () => {
  it('keeps 0–100, clamps the rest, falls back to the middle', () => {
    expect(normalizeCoverPosition(0)).toBe(0)
    expect(normalizeCoverPosition(37.5)).toBe(37.5)
    expect(normalizeCoverPosition(100)).toBe(100)
    expect(normalizeCoverPosition(-20)).toBe(0)
    expect(normalizeCoverPosition(250)).toBe(100)
    expect(normalizeCoverPosition(null)).toBe(COVER_POSITION_DEFAULT)
    expect(normalizeCoverPosition(undefined)).toBe(COVER_POSITION_DEFAULT)
    expect(normalizeCoverPosition(Number.NaN)).toBe(COVER_POSITION_DEFAULT)
    expect(normalizeCoverPosition('30')).toBe(COVER_POSITION_DEFAULT)
  })
})
