import { describe, expect, it } from 'vitest'

import { DEFAULT_TABLE_COLUMN_WIDTH, tableColumnCount, tableColumnWidths } from '@/views/table-columns'

const row = (...colSpans: (null | number | undefined)[]) => ({ children: colSpans.map((colSpan) => ({ colSpan })) })

describe('table column widths (guest view = what the editor shows)', () => {
  it("is Payload's 92px default", () => {
    expect(DEFAULT_TABLE_COLUMN_WIDTH).toBe(92)
  })

  it('counts the first row, merged cells by their colSpan', () => {
    expect(tableColumnCount({ children: [row(1, 1, 1), row(1)] })).toBe(3)
    expect(tableColumnCount({ children: [row(2, undefined, null)] })).toBe(4)
    expect(tableColumnCount({ children: [] })).toBe(0)
    expect(tableColumnCount({})).toBe(0)
  })

  it('keeps saved widths that match the columns', () => {
    expect(tableColumnWidths({ children: [row(1, 1, 1)], colWidths: [160, 140, 220] })).toEqual([160, 140, 220])
  })

  it('gives every column 92px when the table has no widths (Payload does the same in the editor)', () => {
    expect(tableColumnWidths({ children: [row(1, 1, 1)] })).toEqual([92, 92, 92])
    expect(tableColumnWidths({ children: [row(1, 1)], colWidths: [] })).toEqual([92, 92])
    expect(tableColumnWidths({ children: [row(1, 1)], colWidths: 'oops' })).toEqual([92, 92])
  })

  it('trims extra widths and repeats the last width for missing ones (Lexical’s table transform)', () => {
    expect(tableColumnWidths({ children: [row(1, 1)], colWidths: [100, 200, 300] })).toEqual([100, 200])
    expect(tableColumnWidths({ children: [row(1, 1, 1, 1)], colWidths: [100, 150] })).toEqual([100, 150, 150, 150])
  })

  it('treats invalid widths as "no width" instead of breaking the layout', () => {
    expect(tableColumnWidths({ children: [row(1, 1, 1)], colWidths: [100, -5, Number.NaN] })).toEqual([100, 0, 0])
    expect(tableColumnWidths({ children: [row(1, 1)], colWidths: ['100', null] })).toEqual([0, 0])
  })

  it('has no columns for a table without rows', () => {
    expect(tableColumnWidths({ children: [] })).toEqual([])
  })
})
