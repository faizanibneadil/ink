import type { Media, Note } from '@/payload-types'

import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, TOO_LARGE_MESSAGE } from '@/collections/media-rules'

import { messageFor } from '../note-autosave/saveNote'
import { runNoteRequest } from '../note-requests'
import { type NoteHeaderImage, toHeaderImage } from './header-data'

/** The two header images of a note. */
export type HeaderImageField = 'cover' | 'icon'

// Same rules as the server (the Media collection refuses anything else too)
export { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/collections/media-rules'

export class HeaderImageError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'HeaderImageError'
    }
}

/** Why this file cannot be a cover / icon, or `null` when it can. */
export const validateImageFile = (file: Pick<File, 'size' | 'type'>): null | string => {
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        return 'Choose an image file (PNG, JPEG, GIF, WebP or AVIF).'
    }
    if (file.size === 0) {
        return 'This file is empty.'
    }
    if (file.size > MAX_IMAGE_BYTES) {
        return TOO_LARGE_MESSAGE
    }
    return null
}

/** Alt text of an uploaded header image, e.g. "Trip to Hunza – cover". */
export const headerImageAlt = (title: string, field: HeaderImageField): string => {
    const name = title.trim().replace(/\s+/g, ' ').slice(0, 120) || 'Note'
    return `${name} – ${field}`
}

const request = async (input: string, init: RequestInit): Promise<Response> => {
    let response: Response
    try {
        response = await fetch(input, { credentials: 'include', ...init })
    } catch {
        throw new HeaderImageError("Couldn't reach the server. Check your connection.")
    }
    if (!response.ok) {
        throw new HeaderImageError(await messageFor(response))
    }
    return response
}

/** Uploads an image to the Media collection (`POST /api/media`). */
export const uploadImage = async (file: File, alt: string): Promise<Media> => {
    const problem = validateImageFile(file)
    if (problem) throw new HeaderImageError(problem)
    const form = new FormData()
    form.append('file', file)
    form.append('_payload', JSON.stringify({ alt }))
    const response = await request('/api/media', { body: form, method: 'POST' })
    const { doc } = (await response.json()) as { doc: Media }
    return doc
}

/** Best effort: removes an uploaded file that ended up not being used. */
export const deleteMedia = async (id: number): Promise<void> => {
    try {
        await fetch(`/api/media/${id}`, { credentials: 'include', method: 'DELETE' })
    } catch {
        // Nothing else to do: it stays in the Media library
    }
}

/**
 * Sets the note's cover / icon (`PATCH /api/notes/:id`, only that field), queued with the autosave of the same note.
 * Returns the image as the header shows it.
 */
export const setNoteImage = (noteId: number | string, field: HeaderImageField, mediaId: number) =>
    runNoteRequest(noteId, async (): Promise<NoteHeaderImage> => {
        const response = await request(`/api/notes/${encodeURIComponent(String(noteId))}?depth=1`, {
            body: JSON.stringify({ [field]: mediaId }),
            headers: { 'Content-Type': 'application/json' },
            method: 'PATCH',
        })
        const { doc } = (await response.json()) as { doc: Note }
        const image = toHeaderImage(doc[field])
        if (!image) throw new HeaderImageError("Couldn't show this image.")
        return image
    })

/** Uploads the file and makes it the note's cover / icon. A file whose note update fails is removed again. */
export const uploadHeaderImage = async ({
    field,
    file,
    noteId,
    title,
}: {
    field: HeaderImageField
    file: File
    noteId: number | string
    title: string
}): Promise<NoteHeaderImage> => {
    const media = await uploadImage(file, headerImageAlt(title, field))
    try {
        return await setNoteImage(noteId, field, media.id)
    } catch (error) {
        await deleteMedia(media.id)
        throw error
    }
}

/** Images per page in the picker's Media library. */
export const LIBRARY_PAGE_SIZE = 24

export type LibraryPage = { docs: Media[]; hasNextPage: boolean; page: number }

/**
 * One page of images from the Media library, newest first. Only the image types the header accepts (no SVG, no
 * other files), and only the fields the grid needs (`filename` is needed for Payload to build `url`).
 */
export const listLibraryImages = async (page: number): Promise<LibraryPage> => {
    const params = new URLSearchParams({
        depth: '0',
        limit: String(LIBRARY_PAGE_SIZE),
        page: String(page),
        sort: '-createdAt',
        'where[mimeType][in]': ACCEPTED_IMAGE_TYPES.join(','),
    })
    for (const field of ['alt', 'filename', 'height', 'mimeType', 'url', 'width']) {
        params.set(`select[${field}]`, 'true')
    }
    const response = await request(`/api/media?${params.toString()}`, { method: 'GET' })
    const body = (await response.json()) as { docs: Media[]; hasNextPage: boolean; page: number }
    return { docs: body.docs, hasNextPage: body.hasNextPage, page: body.page }
}

/** Stores the cover's vertical position (0–100), queued with the other writes of the note. */
export const setCoverPosition = (noteId: number | string, coverPosition: number) =>
    runNoteRequest(noteId, async (): Promise<number> => {
        const response = await request(`/api/notes/${encodeURIComponent(String(noteId))}?depth=0`, {
            body: JSON.stringify({ coverPosition }),
            headers: { 'Content-Type': 'application/json' },
            method: 'PATCH',
        })
        const { doc } = (await response.json()) as { doc: Note }
        return typeof doc.coverPosition === 'number' ? doc.coverPosition : coverPosition
    })
