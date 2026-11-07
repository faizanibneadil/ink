import { describe, expect, it } from 'vitest'

import { indentText } from '@/features/code-block/notion/indent'

/** `|` marks the caret / selection ends in these strings. */
const parse = (text: string) => {
  const start = text.indexOf('|')
  const rest = text.slice(0, start) + text.slice(start + 1)
  const second = rest.indexOf('|')
  return second === -1
    ? { end: start, start, value: rest }
    : { end: second, start, value: rest.slice(0, second) + rest.slice(second + 1) }
}
const show = ({ selectionEnd, selectionStart, value }: { selectionEnd: number; selectionStart: number; value: string }) =>
  selectionStart === selectionEnd
    ? value.slice(0, selectionStart) + '|' + value.slice(selectionStart)
    : value.slice(0, selectionStart) + '|' + value.slice(selectionStart, selectionEnd) + '|' + value.slice(selectionEnd)
const run = (text: string, outdent = false) => {
  const { end, start, value } = parse(text)
  return show(indentText(value, start, end, outdent))
}

describe('indentText (Tab / Shift+Tab in the code block)', () => {
  it('Tab with a caret inserts two spaces there', () => {
    expect(run('const a|= 1')).toBe('const a  |= 1')
    expect(run('|x')).toBe('  |x')
  })

  it('Tab with a selection indents every selected line and keeps them selected', () => {
    expect(run('|a\nb\nc|')).toBe('  |a\n  b\n  c|')
    expect(run('a\nb|b\ncc|\nd')).toBe('a\n  b|b\n  cc|\nd')
  })

  it('a selection ending at the start of a line does not indent that line', () => {
    expect(run('|a\nb\n|c')).toBe('  |a\n  b\n|c')
  })

  it('Shift+Tab removes one indent (or one space / tab) from each line', () => {
    expect(run('    a|', true)).toBe('  a|')
    expect(run('|  a\n b\nc|', true)).toBe('|a\nb\nc|')
    expect(run('\tx|', true)).toBe('x|')
  })

  it('Shift+Tab with the caret inside the removed indent puts it at the line start', () => {
    expect(run(' | a', true)).toBe('|a')
  })

  it('Shift+Tab on a line without indent changes nothing', () => {
    expect(run('ab|c', true)).toBe('ab|c')
  })

  it('only the selected lines change', () => {
    expect(run('x\n|y|\nz')).toBe('x\n  |y|\nz')
    expect(run('  x\n  |y|\n  z', true)).toBe('  x\n|y|\n  z')
  })
})
