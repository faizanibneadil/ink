import { codeLanguages } from '../shared/languages'
import { CopyButton } from './CopyButton'
import { highlightLines } from './highlight'

// Notion-style read-only code block styles (line numbers, Copy button, highlight.js colours)
import './code-block-viewer.css'

/**
 * Read-only code block: line numbers + syntax highlighting (highlight.js), Copy button, no editor.
 *
 * No hooks and no 'use client': in the guest note view (a Server Component, src/views/note-viewer.tsx) it renders on
 * the server, so highlight.js and its grammars stay out of the browser; only CopyButton is a client component.
 * The note page editor (a client tree) imports it too, as the code block's loading fallback.
 */
export const CodeBlockView: React.FC<{ code: string, filename?: null | string, language?: null | string }> = ({
    code,
    filename,
    language,
}) => {
    const lines = highlightLines(code, language)
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
                        // highlight.js output: only <span class="hljs-*"> and escaped text
                        <span className="note-view__code-line" dangerouslySetInnerHTML={{ __html: line }} key={index} />
                    ))}
                </code>
            </pre>
        </div>
    )
}
