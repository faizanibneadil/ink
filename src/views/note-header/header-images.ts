import type { Media, Note } from '@/payload-types'

import { messageFor } from '../note-autosave/saveNote'
import { runNoteRequest } from '../note-requests'
import { type NoteHeaderImage, toHeaderImage } from './header-data'

/** The two header images of a note. */
export type HeaderImageField = 'cover' | 'icon'

/** Image types the picker accepts (no SVG: it can carry scripts and is served from this site). */
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'] as const
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

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
        return 'This image is too large. The maximum is 10 MB.'
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
