import type { EditorThemeClasses } from '@payloadcms/richtext-lexical/lexical'

/**
 * Classes of the read-only note view (note-viewer.css) added next to Payload's own Lexical theme classes in the
 * `notion` view (./config.tsx), so the editor on `/<slug>` uses the same typography as the guest view.
 *
 * Only plain text elements: lists, checklists and tables keep Payload's classes alone, because their editing UI
 * (checkbox click target, cell resizers / action buttons) depends on Payload's own styles.
 */
const NOTE_VIEW_CLASSES = {
    root: 'note-view',
    paragraph: 'note-view__p',
    quote: 'note-view__quote',
    hr: 'note-view__hr',
    link: 'note-view__link',
    heading: {
        h1: 'note-view__h1',
        h2: 'note-view__h2',
        h3: 'note-view__h3',
        h4: 'note-view__h4',
        h5: 'note-view__h5',
        h6: 'note-view__h6',
    },
    text: {
        bold: 'note-view__bold',
        code: 'note-view__code',
        italic: 'note-view__italic',
        strikethrough: 'note-view__strike',
        underline: 'note-view__underline',
        underlineStrikethrough: 'note-view__underline note-view__strike',
    },
} as const

type ClassTree = { readonly [key: string]: ClassTree | string }

const joinClasses = (base: unknown, extra: string): string =>
    typeof base === 'string' && base.trim() ? `${base} ${extra}` : extra

const addClasses = (theme: Record<string, unknown>, extra: ClassTree): Record<string, unknown> => {
    const result: Record<string, unknown> = { ...theme }
    for (const [key, value] of Object.entries(extra)) {
        if (typeof value === 'string') {
            result[key] = joinClasses(theme[key], value)
        } else {
            const nested = theme[key]
            result[key] = addClasses(nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : {}, value)
        }
    }
    return result
}

/** Payload's theme with the note view classes added (Payload's classes are kept, nothing is removed). */
export const addNoteViewClasses = (theme: EditorThemeClasses | undefined): EditorThemeClasses =>
    addClasses((theme ?? {}) as Record<string, unknown>, NOTE_VIEW_CLASSES) as EditorThemeClasses
