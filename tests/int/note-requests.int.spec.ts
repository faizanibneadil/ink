import { describe, expect, it } from 'vitest'

import { headerImageAlt, MAX_IMAGE_BYTES, validateImageFile } from '@/views/note-header/header-images'
import { runNoteRequest } from '@/views/note-requests'

const deferred = () => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, reject, resolve }
}

describe('runNoteRequest (one write request per note at a time)', () => {
  it('runs requests for the same note one after another, in order', async () => {
    const log: string[] = []
    const first = deferred()
    const a = runNoteRequest(1, async () => {
      log.push('a start')
      await first.promise
      log.push('a end')
      return 'a'
    })
    const b = runNoteRequest(1, async () => {
      log.push('b start')
      return 'b'
    })
    await Promise.resolve()
    expect(log).toEqual(['a start'])
    first.resolve()
    expect(await a).toBe('a')
    expect(await b).toBe('b')
    expect(log).toEqual(['a start', 'a end', 'b start'])
  })

  it('a failed request does not block the next one, and its error reaches its caller', async () => {
    const failing = runNoteRequest('2', async () => {
      throw new Error('boom')
    })
    const next = runNoteRequest(2, async () => 'ok')
    await expect(failing).rejects.toThrow('boom')
    await expect(next).resolves.toBe('ok')
  })

  it('different notes do not wait for each other', async () => {
    const slow = deferred()
    const log: string[] = []
    const a = runNoteRequest(3, async () => {
      await slow.promise
      log.push('note 3')
    })
    const b = runNoteRequest(4, async () => {
      log.push('note 4')
    })
    await b
    expect(log).toEqual(['note 4'])
    slow.resolve()
    await a
  })
})

describe('header image files', () => {
  it('accepts PNG, JPEG, GIF, WebP and AVIF up to 10 MB', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']) {
      expect(validateImageFile({ size: 1000, type })).toBeNull()
    }
    expect(validateImageFile({ size: MAX_IMAGE_BYTES, type: 'image/png' })).toBeNull()
  })

  it('refuses other files, SVG, empty and too large files', () => {
    expect(validateImageFile({ size: 10, type: 'text/plain' })).toMatch(/Choose an image file/)
    expect(validateImageFile({ size: 10, type: 'image/svg+xml' })).toMatch(/Choose an image file/)
    expect(validateImageFile({ size: 10, type: '' })).toMatch(/Choose an image file/)
    expect(validateImageFile({ size: 0, type: 'image/png' })).toBe('This file is empty.')
    expect(validateImageFile({ size: MAX_IMAGE_BYTES + 1, type: 'image/png' })).toMatch(/too large/)
  })

  it('alt text: note title + which image', () => {
    expect(headerImageAlt('Trip to Hunza', 'cover')).toBe('Trip to Hunza – cover')
    expect(headerImageAlt('  Many   spaces\nhere ', 'icon')).toBe('Many spaces here – icon')
    expect(headerImageAlt('', 'icon')).toBe('Note – icon')
    expect(headerImageAlt('x'.repeat(300), 'cover')).toBe(`${'x'.repeat(120)} – cover`)
  })
})
