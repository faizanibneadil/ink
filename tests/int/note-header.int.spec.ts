import { describe, expect, it } from 'vitest'

import type { Media } from '@/payload-types'
import { getNoteHeaderData, toHeaderImage } from '@/views/note-header/header-data'

const media = (data: Partial<Media>): Media =>
  ({
    alt: 'Alt text',
    createdAt: '',
    height: 600,
    id: 1,
    mimeType: 'image/png',
    updatedAt: '',
    url: '/api/media/file/a.png',
    width: 1200,
    ...data,
  }) as Media

describe('note header data', () => {
  it('keeps only what the page needs from a media file', () => {
    expect(toHeaderImage(media({}))).toEqual({ alt: 'Alt text', height: 600, url: '/api/media/file/a.png', width: 1200 })
  })

  it('cannot show: not populated (id only), missing, not an image, no URL', () => {
    expect(toHeaderImage(7)).toBeNull()
    expect(toHeaderImage(null)).toBeNull()
    expect(toHeaderImage(undefined)).toBeNull()
    expect(toHeaderImage(media({ mimeType: 'application/pdf' }))).toBeNull()
    expect(toHeaderImage(media({ mimeType: null }))).toBeNull()
    expect(toHeaderImage(media({ url: null }))).toBeNull()
    expect(toHeaderImage(media({ url: '' }))).toBeNull()
  })

  it('missing / bad sizes become null (the image still shows)', () => {
    expect(toHeaderImage(media({ height: null, width: 0 }))).toMatchObject({ height: null, width: null })
  })

  it('note header: cover, icon and a safe cover position', () => {
    expect(getNoteHeaderData({ cover: media({}), coverPosition: 20, icon: 3 })).toEqual({
      cover: { alt: 'Alt text', height: 600, url: '/api/media/file/a.png', width: 1200 },
      coverPosition: 20,
      icon: null,
    })
    expect(getNoteHeaderData({ cover: null, coverPosition: null, icon: null })).toEqual({
      cover: null,
      coverPosition: 50,
      icon: null,
    })
    expect(getNoteHeaderData({ coverPosition: 500 }).coverPosition).toBe(100)
  })
})
