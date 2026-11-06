import { normalizeCoverPosition } from '@/collections/note-header'
import type { Media, Note } from '@/payload-types'

/** What the page header needs from a media file (only plain values: it is passed from the server page to the client). */
export type NoteHeaderImage = {
    alt: string
    height: null | number
    url: string
    width: null | number
}

/** Cover photo + icon of a note (Notion-style page header). */
export type NoteHeaderData = {
    cover: NoteHeaderImage | null
    /** Vertical position of the cover photo, 0 (top) to 100 (bottom) */
    coverPosition: number
    icon: NoteHeaderImage | null
}

const toPositiveNumber = (value: unknown): null | number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null

/**
 * A populated media document as a header image, or `null` when it cannot be shown: not populated (only an id,
 * e.g. the file was deleted or the reader may not see it), not an image, or without a URL.
 */
export const toHeaderImage = (value: Media | null | number | undefined): NoteHeaderImage | null => {
    if (!value || typeof value !== 'object') {
        return null
    }
    if (typeof value.url !== 'string' || !value.url) {
        return null
    }
    if (typeof value.mimeType !== 'string' || !value.mimeType.startsWith('image/')) {
        return null
    }
    return {
        alt: typeof value.alt === 'string' ? value.alt : '',
        height: toPositiveNumber(value.height),
        url: value.url,
        width: toPositiveNumber(value.width),
    }
}

/** Header of a note found with `depth >= 1` (cover / icon populated). */
export const getNoteHeaderData = (note: Pick<Note, 'cover' | 'coverPosition' | 'icon'>): NoteHeaderData => ({
    cover: toHeaderImage(note.cover),
    coverPosition: normalizeCoverPosition(note.coverPosition),
    icon: toHeaderImage(note.icon),
})
