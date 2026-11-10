import { describe, expect, it } from 'vitest'

import { plainLines } from '@/features/code-block/viewer/CodeBlockFrame'
import { highlightLines } from '@/features/code-block/viewer/highlight'

/*
 * The note page editor shows `plainLines` while the chunk with highlight.js loads
 * (src/features/code-block/notion/view.tsx). It must be the same lines highlight.js renders without colours, so the
 * block does not change size or text when the colours arrive.
 */
const SAMPLES = [
  '',
  'one line',
  'a\nb\nc',
  'trailing newline\n',
  'blank\n\nlines\n\n',
  '<div class="x">&amp; "quotes" \'single\'</div>',
  '\ttabs\n    spaces',
]

/** The text a line shows in the browser (tags dropped, entities decoded; `'` may or may not be escaped). */
const text = (html: string) => {
  const element = document.createElement('span')
  element.innerHTML = html
  return element.textContent
}

describe('plainLines', () => {
  it.each(SAMPLES)('shows the same lines and text as the highlighted block: %j', (code) => {
    for (const language of ['ts', 'plaintext', null]) {
      const highlighted = highlightLines(code, language)
      expect(plainLines(code).length, String(language)).toBe(highlighted.length)
      expect(plainLines(code).map(text), String(language)).toEqual(highlighted.map(text))
    }
  })

  it('is escaped HTML (no markup from the code)', () => {
    expect(plainLines('<b>&</b>')).toEqual(['&lt;b&gt;&amp;&lt;/b&gt;'])
  })
})
