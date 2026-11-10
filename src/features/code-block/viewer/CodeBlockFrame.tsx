import { codeLanguages } from '../shared/languages'
import { CopyButton } from './CopyButton'

// Notion-style read-only code block styles (line numbers, Copy button, highlight.js colours)
import './code-block-viewer.css'

const escapeHTML = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The code as plain (escaped) HTML lines, like `highlightLines` without colours. Used while highlight.js loads. */
export const plainLines = (code: string): string[] => escapeHTML(code.replace(/\n$/, '')).split('\n')

/**
 * Markup of the read-only code block: header (file name · language, Copy) and one element per line. `lines` are HTML
 * strings: highlight.js output (./CodeBlockView.tsx) or `plainLines` (the editor's fallback while the editable block
 * and highlight.js load, src/features/code-block/notion/view.tsx). No highlight.js import here.
 */
export const CodeBlockFrame: React.FC<{
    code: string
    filename?: null | string
    language?: null | string
    lines: string[]
}> = ({ code, filename, language, lines }) => {
    const languageLabel = language ? codeLanguages[language as keyof typeof codeLanguages] ?? language : ''
    // File name first when set: "app.tsx · TypeScript"
    const label = [filename?.trim(), languageLabel].filter(Boolean).join(' · ')

    return (
        <div className="note-view__codeblock">
            <div className="note-view__codeblock-header">
                <span className="note-view__codeblock-lang">
                    {label}
                </span>
                <CopyButton code={code} />
            </div>
            {/* One element per line: CSS adds the line numbers (not selectable, not copied) */}
            <pre
                className="note-view__codeblock-pre"
                style={{ '--note-line-digits': String(lines.length).length } as React.CSSProperties}
            >
                <code className="hljs">
                    {lines.map((line, index) => (
                        // Only <span class="hljs-*"> and escaped text
                        <span className="note-view__code-line" dangerouslySetInnerHTML={{ __html: line }} key={index} />
                    ))}
                </code>
            </pre>
        </div>
    )
}
