/** Indentation inserted by Tab in the note page's code block. */
export const INDENT = '  '

export type TextEdit = { selectionEnd: number; selectionStart: number; value: string }

const lineStartOf = (value: string, index: number) => value.lastIndexOf('\n', index - 1) + 1

/**
 * Tab / Shift+Tab in the code block, like a code editor:
 * - Tab, nothing selected on one line: inserts the indent at the caret
 * - Tab with a selection: indents every selected line
 * - Shift+Tab: removes up to one indent from every selected line (or the caret's line)
 */
export const indentText = (
    value: string,
    selectionStart: number,
    selectionEnd: number,
    outdent: boolean,
): TextEdit => {
    const singleCaret = selectionStart === selectionEnd
    if (!outdent && singleCaret) {
        return {
            selectionEnd: selectionStart + INDENT.length,
            selectionStart: selectionStart + INDENT.length,
            value: value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd),
        }
    }

    const blockStart = lineStartOf(value, selectionStart)
    // A selection that ends right at the start of a line does not include that line
    const lastIndex = selectionEnd > selectionStart && value[selectionEnd - 1] === '\n' ? selectionEnd - 1 : selectionEnd
    const nextBreak = value.indexOf('\n', lastIndex)
    const blockEnd = nextBreak === -1 ? value.length : nextBreak
    const lines = value.slice(blockStart, blockEnd).split('\n')

    // Every line is changed at its start: `remove` characters taken away, or the indent added
    const edits: { at: number; insert: number; remove: number }[] = []
    let at = blockStart
    for (const line of lines) {
        const remove = !outdent ? 0 : line.startsWith(INDENT) ? INDENT.length : /^[ \t]/.test(line) ? 1 : 0
        edits.push({ at, insert: outdent ? 0 : INDENT.length, remove })
        at += line.length + 1
    }

    /** Where a position of the old text ends up in the new text. */
    const map = (position: number) => {
        let shift = 0
        for (const edit of edits) {
            if (position < edit.at) break
            if (position < edit.at + edit.remove) return edit.at + shift
            // A caret exactly at a line start stays before an indent added there only for the selection start
            shift += edit.insert - edit.remove
        }
        return position + shift
    }

    const changed = lines.map((line, index) =>
        outdent ? line.slice(edits[index].remove) : INDENT + line,
    )
    return {
        selectionEnd: map(selectionEnd),
        selectionStart: map(selectionStart),
        value: value.slice(0, blockStart) + changed.join('\n') + value.slice(blockEnd),
    }
}
