// @vitest-environment node
// Server code (Payload local API, uploads): Node, not jsdom (file type detection needs Node's own Buffer)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/collections/media-rules'
import type { Media, User } from '@/payload-types'
import config from '@/payload.config'

/*
 * The Media collection accepts images only (PNG, JPEG, GIF, WebP, AVIF up to 10 MB), for everyone — admins and the
 * local API included. Payload checks the file's content, so a file that only claims to be an image is refused too.
 * Real local database + real uploads (local `media/` folder), removed again afterwards.
 */

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures')
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name))
const RUN = `media-int-${Date.now()}`

let payload: Payload
let admin: User
const created: number[] = []

type Upload = { data: Buffer; mimetype: string; name: string }

/** Uploads as an admin through the access-checked API (what the admin UI and REST do). */
const upload = async ({ data, mimetype, name }: Upload): Promise<Media> => {
  const doc = await payload.create({
    collection: 'media',
    data: { alt: `${RUN} ${name}` },
    file: { data, mimetype, name: `${RUN}-${name}`, size: data.length },
    overrideAccess: false,
    user: admin,
  })
  created.push(doc.id)
  return doc
}

const refused = async (file: Upload) => {
  const before = await payload.count({ collection: 'media', overrideAccess: true, where: { alt: { like: RUN } } })
  await expect(upload(file)).rejects.toThrow()
  const after = await payload.count({ collection: 'media', overrideAccess: true, where: { alt: { like: RUN } } })
  // Nothing was stored
  expect(after.totalDocs).toBe(before.totalDocs)
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  admin = (await payload.create({
    collection: 'users',
    data: { email: `${RUN}@example.com`, password: 'test1234', role: 'admin', username: RUN },
    overrideAccess: true,
  })) as User
})

afterAll(async () => {
  for (const id of created) {
    await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => {})
  }
  if (admin) await payload.delete({ collection: 'users', id: admin.id, overrideAccess: true }).catch(() => {})
})

describe('Media: images only', () => {
  it('is configured with exactly the image types the note page offers', () => {
    const uploadConfig = payload.collections.media.config.upload
    expect(uploadConfig.mimeTypes).toEqual([...ACCEPTED_IMAGE_TYPES])
  })

  it.each([
    ['icon.png', 'image/png'],
    ['tiny.jpg', 'image/jpeg'],
    ['tiny.gif', 'image/gif'],
    ['tiny.webp', 'image/webp'],
    ['tiny.avif', 'image/avif'],
  ])('accepts %s (%s)', async (name, mimetype) => {
    const doc = await upload({ data: fixture(name), mimetype, name })
    expect(doc.mimeType).toBe(mimetype)
    expect(doc.filesize).toBeGreaterThan(0)
  })

  it('refuses SVG, even from an admin (it can carry scripts)', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    await refused({ data: svg, mimetype: 'image/svg+xml', name: 'logo.svg' })
    // Renamed to .png and claiming to be a PNG: the content gives it away
    await refused({ data: svg, mimetype: 'image/png', name: 'logo.png' })
  })

  it('refuses other files: text, HTML, PDF, a disguised script', async () => {
    await refused({ data: Buffer.from('plain text'), mimetype: 'text/plain', name: 'notes.txt' })
    await refused({ data: Buffer.from('<html><script>alert(1)</script></html>'), mimetype: 'text/html', name: 'page.html' })
    await refused({ data: Buffer.from('<html><script>alert(1)</script></html>'), mimetype: 'image/png', name: 'page.png' })
    await refused({ data: Buffer.from('%PDF-1.4\n%%EOF\n'), mimetype: 'application/pdf', name: 'doc.pdf' })
    await refused({ data: Buffer.from('#!/bin/sh\necho hi\n'), mimetype: 'image/jpeg', name: 'run.jpg' })
  })

  it('refuses images over 10 MB, accepts exactly 10 MB', async () => {
    const png = fixture('icon.png')
    const tooBig = Buffer.alloc(MAX_IMAGE_BYTES + 1)
    png.copy(tooBig)
    const error = await upload({ data: tooBig, mimetype: 'image/png', name: 'huge.png' }).then(
      () => null,
      (failure: unknown) => failure as { data?: { errors?: { message: string; path: string }[] } },
    )
    expect(error?.data?.errors).toEqual([{ message: 'This image is too large. The maximum is 10 MB.', path: 'file' }])

    const atLimit = Buffer.alloc(MAX_IMAGE_BYTES)
    png.copy(atLimit)
    const doc = await upload({ data: atLimit, mimetype: 'image/png', name: 'limit.png' })
    expect(doc.filesize).toBe(MAX_IMAGE_BYTES)
  })

  it('refuses replacing an image with a non-image file', async () => {
    const doc = await upload({ data: fixture('icon.png'), mimetype: 'image/png', name: 'replace.png' })
    const text = Buffer.from('plain text')
    await expect(
      payload.update({
        collection: 'media',
        data: {},
        file: { data: text, mimetype: 'text/plain', name: `${RUN}-replace.txt`, size: text.length },
        id: doc.id,
        overrideAccess: false,
        user: admin,
      }),
    ).rejects.toThrow()
    const found = await payload.findByID({ collection: 'media', id: doc.id, overrideAccess: true })
    expect(found.mimeType).toBe('image/png')
  })
})
