import { type Slugify, slugify } from 'payload/shared'

/** Longest slug, including the `-N` suffix Payload adds when a slug is already taken. */
export const NOTE_SLUG_MAX_LENGTH = 60

/** Room kept for Payload's dedupe suffix (`-1` ... `-50`). */
const SUFFIX_ROOM = 4
const BASE_MAX_LENGTH = NOTE_SLUG_MAX_LENGTH - SUFFIX_ROOM

type LexicalNodeLike = {
    children?: unknown
    text?: unknown
    type?: unknown
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

/** All text inside a node (e.g. a paragraph with bold, italic or link parts). */
const getNodeText = (node: LexicalNodeLike): string => {
    if (typeof node.text === 'string') {
        return node.text
    }
    if (!Array.isArray(node.children)) {
        return ''
    }
    return node.children.map((child) => (isObject(child) ? getNodeText(child) : '')).join('')
}

/**
 * Text of the note's first heading or paragraph that has text, from the saved Lexical editor state.
 * Other nodes (lists, quotes, tables, drawings, code blocks...) are skipped.
 */
export const getNoteFirstLine = (editorState: unknown): string => {
    if (!isObject(editorState) || !isObject(editorState.root) || !Array.isArray(editorState.root.children)) {
        return ''
    }
    for (const node of editorState.root.children) {
        if (!isObject(node) || (node.type !== 'heading' && node.type !== 'paragraph')) {
            continue
        }
        const text = getNodeText(node).trim()
        if (text) {
            return text
        }
    }
    return ''
}

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
export const slugifyNote: Slugify = ({ valueToSlugify }) => {
    const text = typeof valueToSlugify === 'string' ? valueToSlugify : getNoteFirstLine(valueToSlugify)
    return slugifyText(text) || undefined
}
