import { CodeBlockFrame } from './CodeBlockFrame'
import { highlightLines } from './highlight'

/**
 * Read-only code block: line numbers + syntax highlighting (highlight.js), Copy button, no editor.
 *
 * No hooks and no 'use client': in the guest note view (a Server Component, src/views/note-viewer.tsx) it renders on
 * the server, so highlight.js and its grammars stay out of the browser; only CopyButton is a client component.
 * In the note page editor it is only reached through the lazy NotionCodeBlock chunk (src/features/code-block/notion),
 * so highlight.js is downloaded only for notes with a code block.
 */
export const CodeBlockView: React.FC<{ code: string, filename?: null | string, language?: null | string }> = ({
    code,
    filename,
    language,
}) => <CodeBlockFrame code={code} filename={filename} language={language} lines={highlightLines(code, language)} />
