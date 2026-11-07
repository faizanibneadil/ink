/**
 * Column widths of a table in the read-only view, the same ones the editor shows.
 *
 * In the editor, Payload's table feature always gives a table column widths: Payload's column resizer
 * (`TableCellResizerPlugin`) sets every column to 92px when a table has none, and Lexical's table transform pads /
 * trims saved widths to the number of columns (repeating the last width). A table saved without widths (made through
 * the API, or not edited since) therefore shows 92px columns in the editor; the read-only view applies the same rules,
 * so a table looks the same for guests and while editing.
 */

/** Payload's default (and minimum) column width (`MIN_COLUMN_WIDTH` in Payload's `TableCellResizerPlugin`). */
export const DEFAULT_TABLE_COLUMN_WIDTH = 92

type TableLike = {
    children?: readonly { children?: readonly { colSpan?: null | number }[] }[]
    colWidths?: unknown
}

/** Number of columns: the first row's cells, counting merged cells by their `colSpan` (Lexical's `getColumnCount`). */
export const tableColumnCount = (table: TableLike): number =>
    (table.children?.[0]?.children ?? []).reduce(
        (count, cell) => count + (typeof cell.colSpan === 'number' && cell.colSpan > 1 ? cell.colSpan : 1),
        0,
    )

/** Width of each column in pixels (`0` = no width, like Lexical's colgroup). */
export const tableColumnWidths = (table: TableLike): number[] => {
    const count = tableColumnCount(table)
    const saved = Array.isArray(table.colWidths)
        ? table.colWidths.map((width) => (typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : 0))
        : []
    if (saved.length === 0) {
        return Array<number>(count).fill(DEFAULT_TABLE_COLUMN_WIDTH)
    }
    if (saved.length >= count) {
        return saved.slice(0, count)
    }
    return [...saved, ...Array<number>(count - saved.length).fill(saved[saved.length - 1])]
}
