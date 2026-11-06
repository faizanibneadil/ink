/*
 * Plain text from a note's saved Lexical state. No Payload / server imports: also used in the browser (note page editor).
 */

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
