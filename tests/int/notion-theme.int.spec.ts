import { describe, expect, it } from 'vitest'

import { addNoteViewClasses } from '@/views/notion-theme'

describe('notion view theme', () => {
  const payloadTheme = {
    heading: { h1: 'LexicalEditorTheme__h1', h2: 'LexicalEditorTheme__h2' },
    list: { ul: 'LexicalEditorTheme__ul' },
    paragraph: 'LexicalEditorTheme__paragraph',
    root: 'LexicalEditorTheme',
    table: 'LexicalEditorTheme__table',
    text: { bold: 'LexicalEditorTheme__textBold' },
  }

  it("keeps Payload's classes and adds the read-only view's classes", () => {
    const theme = addNoteViewClasses(payloadTheme)
    expect(theme.root).toBe('LexicalEditorTheme note-view')
    expect(theme.paragraph).toBe('LexicalEditorTheme__paragraph note-view__p')
    expect(theme.heading?.h1).toBe('LexicalEditorTheme__h1 note-view__h1')
    expect(theme.heading?.h3).toBe('note-view__h3')
    expect(theme.text?.bold).toBe('LexicalEditorTheme__textBold note-view__bold')
    expect(theme.text?.underlineStrikethrough).toBe('note-view__underline note-view__strike')
  })

  it('leaves lists and tables to Payload (their editing UI needs its own styles)', () => {
    const theme = addNoteViewClasses(payloadTheme)
    expect(theme.list).toEqual({ ul: 'LexicalEditorTheme__ul' })
    expect(theme.table).toBe('LexicalEditorTheme__table')
  })

  it('does not change the theme it gets (the admin editor uses the same default config)', () => {
    const before = JSON.stringify(payloadTheme)
    addNoteViewClasses(payloadTheme)
    expect(JSON.stringify(payloadTheme)).toBe(before)
  })

  it('works without a theme', () => {
    expect(addNoteViewClasses(undefined).paragraph).toBe('note-view__p')
  })
})
