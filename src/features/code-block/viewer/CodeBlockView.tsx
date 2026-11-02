'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { codeLanguages } from '../shared/languages'
import { highlightLines } from './highlight'

// Notion-style read-only code block styles (line numbers, Copy button, highlight.js colours)
import './code-block-viewer.css'

const cx = (...classes: (0 | false | null | string | undefined)[]) => classes.filter(Boolean).join(' ')

const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
    }
    // Fallback for browsers / insecure contexts without the async clipboard API
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
}

const CopyIcon = () => (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="14">
        <rect height="13" rx="2" width="13" x="9" y="9" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
)

const CheckIcon = () => (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
        <path d="M20 6 9 17l-5-5" />
    </svg>
)

/** Read-only code block: line numbers + syntax highlighting (highlight.js), Copy button, no editor. */
export const CodeBlockView: React.FC<{ code: string, language?: null | string }> = ({ code, language }) => {
    const [copied, setCopied] = useState(false)
    const timeout = useRef<ReturnType<typeof setTimeout>>(undefined)
    const lines = useMemo(() => highlightLines(code, language), [code, language])
    const label = language ? codeLanguages[language as keyof typeof codeLanguages] ?? language : ''

    useEffect(() => () => clearTimeout(timeout.current), [])

    const onCopy = async () => {
        try {
            await copyText(code)
            setCopied(true)
            clearTimeout(timeout.current)
            timeout.current = setTimeout(() => setCopied(false), 2000)
        } catch {
            // Clipboard blocked: leave the button as it is
        }
    }

    return (
        <div className="note-view__codeblock">
            <div className="note-view__codeblock-header">
                <span className="note-view__codeblock-lang">
                    {label}
                </span>
                <button
                    aria-label={copied ? 'Copied' : 'Copy code'}
                    className={cx('note-view__codeblock-copy', copied && 'note-view__codeblock-copy--copied')}
                    onClick={onCopy}
                    type="button"
                >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
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
