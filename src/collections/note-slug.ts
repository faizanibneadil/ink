import type { SanitizedConfig, TextFieldSingleValidation } from 'payload'
import { type Slugify, slugify, text } from 'payload/shared'

import { getReservedSlugs } from '@/utilities/isPayloadRoute'

import { getNoteFirstLine } from './note-text'

export { getNoteFirstLine }

/** Longest slug, including the `-N` suffix Payload adds when a slug is already taken. */
export const NOTE_SLUG_MAX_LENGTH = 60

/** Room kept for Payload's dedupe suffix (`-1` ... `-50`). */
const SUFFIX_ROOM = 4
const BASE_MAX_LENGTH = NOTE_SLUG_MAX_LENGTH - SUFFIX_ROOM

/**
 * Makes a slug from text with Payload's own rules (English letters, numbers, `-` and `_`),
 * at most {@link BASE_MAX_LENGTH} characters, cut at a word boundary when possible.
 */
export const slugifyText = (text: string): string => {
    const normalized = text
        // "Café" -> "Cafe" instead of dropping the letter
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        // tabs / new lines count as spaces
        .replace(/\s+/g, ' ')
    let slug = (slugify(normalized) ?? '')
        .replace(/-{2,}/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '')

    if (slug.length > BASE_MAX_LENGTH) {
        const cut = slug.slice(0, BASE_MAX_LENGTH)
        const lastDash = cut.lastIndexOf('-')
        // Keep whole words, unless that would throw away most of the slug
        slug = (lastDash >= BASE_MAX_LENGTH / 2 ? cut.slice(0, lastDash) : cut).replace(/[-_]+$/g, '')
    }
    return slug
}

/**
 * `slugify` for the notes slug field (`useAsSlug: 'note'`):
 * - the rich text value (Lexical JSON) -> slug from its first heading / paragraph
 * - a string (typed by hand in the slug field) -> cleaned up the same way
 * Returns `undefined` when nothing usable is left, so Payload falls back to `note-1`, `note-2`...
 */
export const slugifyNote: Slugify = ({ req, valueToSlugify }) => {
    const text = typeof valueToSlugify === 'string' ? valueToSlugify : getNoteFirstLine(valueToSlugify)
    const slug = slugifyText(text)
    if (!slug) {
        return undefined
    }
    // Notes live at `/<slug>`, next to the Payload admin (`/login`, `/collections`, ...): never take a Payload route.
    return isReservedNoteSlug(slug, req.payload.config) ? `${slug}${RESERVED_SLUG_SUFFIX}` : slug
}

/** Added to a slug that would be a Payload route, e.g. `login` -> `login-note`. */
export const RESERVED_SLUG_SUFFIX = '-note'

export const isReservedNoteSlug = (slug: string, config: SanitizedConfig): boolean =>
    getReservedSlugs(config).has(slug.toLowerCase())

/** Field validation: rejects a slug that is a Payload route (in case one gets past `slugifyNote`). */
export const validateNoteSlug: TextFieldSingleValidation = (value, args) => {
    if (typeof value === 'string' && isReservedNoteSlug(value, args.req.payload.config)) {
        return `"${value}" is used by the app (it is a Payload admin route). Choose another slug.`
    }
    return text(value, args)
}
