'use client'

import type { NodeKey } from '@payloadcms/richtext-lexical/lexical'

import { $getNodeByKey, stopLexicalPropagation } from '@payloadcms/richtext-lexical/lexical'
import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@payloadcms/richtext-lexical/lexical/react/useLexicalEditable'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { $isCodeBlockServerNode } from '../server/CodeBlockServerNode'
import { takeFocusOnMount } from '../client/focusOnMount'
import { copyText } from '../shared/copyText'
import { codeLanguages, isCodeLanguage } from '../shared/languages'
import { highlightLines } from '../viewer/highlight'
import { CheckIcon, CodeBlockView, CopyIcon } from '../viewer/CodeBlockView'
import { indentText, type TextEdit } from './indent'

import './notion-code-block.css'

type Props = {
    code: string
    filename: string
    language: string
    nodeKey: NodeKey
}

/**
 * Events from the code block's own inputs that Lexical must not handle (typing, Backspace / Enter, Tab, paste,
 * clicks...). `stopLexicalPropagation` marks the event for Lexical's root listener only, so React handlers still run.
 */
const OWN_EVENTS = [
    'beforeinput',
    'click',
    'compositionend',
    'compositionstart',
    'copy',
    'cut',
    'dragstart',
    'drop',
    'input',
    'keydown',
    'keyup',
    'paste',
    'pointerdown',
] as const

const TrashIcon = () => (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="14">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
)

/**
 * Notion-style code block of the note page editor (Lexical `notion` view, src/views/config.tsx). Replaces Monaco
 * there: a plain textarea over the highlighted code (highlight.js, same colours as the read-only view), a language
 * menu, a file name, Copy and Delete. Tab / Shift+Tab indent. Everything is written straight into the Lexical node.
 */
export const NotionCodeBlock: React.FC<Props> = ({ code, filename, language, nodeKey }) => {
    const [editor] = useLexicalComposerContext()
    const isEditable = useLexicalEditable()
    const containerRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const pendingSelection = useRef<null | Pick<TextEdit, 'selectionEnd' | 'selectionStart'>>(null)
    const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const [text, setText] = useState(code)
    const [name, setName] = useState(filename)
    const [copied, setCopied] = useState(false)
    const languageId = useId()

    // The field being typed in. Lexical hands the node's new values back a moment after each change; while the user
    // types, those (older) values must not overwrite what is in the field.
    const [focused, setFocused] = useState<'code' | 'filename' | null>(null)
    // A change made elsewhere (undo / redo of the note, another view) shows here: adjust state while rendering
    // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
    const [seenCode, setSeenCode] = useState(code)
    if (code !== seenCode) {
        setSeenCode(code)
        if (focused !== 'code') setText(code)
    }
    const [seenFilename, setSeenFilename] = useState(filename)
    if (filename !== seenFilename) {
        setSeenFilename(filename)
        if (focused !== 'filename') setName(filename)
    }

    // Inserted just now (slash menu, "+" menu, ``` shortcut): ready to type
    useEffect(() => {
        if (takeFocusOnMount(nodeKey)) textareaRef.current?.focus()
    }, [nodeKey])

    // Hide this block's own events from Lexical (see OWN_EVENTS)
    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const hide = (event: Event) => stopLexicalPropagation(event)
        for (const type of OWN_EVENTS) container.addEventListener(type, hide)
        return () => {
            for (const type of OWN_EVENTS) container.removeEventListener(type, hide)
        }
    }, [isEditable])

    useEffect(() => () => clearTimeout(copiedTimer.current), [])

    // Caret after Tab / Shift+Tab, once React has written the new text
    useLayoutEffect(() => {
        const selection = pendingSelection.current
        if (selection && textareaRef.current) {
            textareaRef.current.setSelectionRange(selection.selectionStart, selection.selectionEnd)
            pendingSelection.current = null
        }
    })

    const updateNode = useCallback(
        (change: (node: ReturnType<typeof getCodeBlock>) => void) => {
            editor.update(() => {
                const node = getCodeBlock(nodeKey)
                if (node) change(node)
            })
        },
        [editor, nodeKey],
    )

    const writeCode = (next: string) => {
        setText(next)
        updateNode((node) => {
            if (node && node.getCode() !== next) node.setCode(next)
        })
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault()
            const area = event.currentTarget
            const edit = indentText(area.value, area.selectionStart, area.selectionEnd, event.shiftKey)
            pendingSelection.current = edit
            writeCode(edit.value)
            return
        }
        if (event.key === 'Escape') {
            // Leave the code block (Tab is taken for indenting)
            event.preventDefault()
            event.currentTarget.blur()
        }
    }

    const onCopy = async () => {
        try {
            await copyText(text)
            setCopied(true)
            clearTimeout(copiedTimer.current)
            copiedTimer.current = setTimeout(() => setCopied(false), 2000)
        } catch {
            // Clipboard blocked: nothing to show
        }
    }

    const html = useMemo(() => {
        const lines = highlightLines(text, language)
        // highlightLines drops a trailing newline; the textarea shows that empty last line, so the overlay must too
        return lines.join('\n') + (text.endsWith('\n') ? '\n ' : '')
    }, [text, language])

    if (!isEditable) {
        return <CodeBlockView code={code} filename={filename} language={language} />
    }

    const languageLabel = isCodeLanguage(language) ? codeLanguages[language] : language

    return (
        <div className="note-view__codeblock notion-code-block" data-testid="notion-code-block" ref={containerRef}>
            <div className="notion-code-block__header">
                <label className="notion-code-block__visually-hidden" htmlFor={languageId}>
                    Language
                </label>
                <select
                    className="notion-code-block__language"
                    id={languageId}
                    onChange={(event) => {
                        const next = event.target.value
                        if (isCodeLanguage(next)) updateNode((node) => node?.setLanguage(next))
                    }}
                    value={isCodeLanguage(language) ? language : 'plaintext'}
                >
                    {Object.entries(codeLanguages).map(([id, label]) => (
                        <option key={id} value={id}>
                            {label}
                        </option>
                    ))}
                </select>
                <input
                    aria-label="File name"
                    className="notion-code-block__filename"
                    onBlur={() => setFocused(null)}
                    onFocus={() => setFocused('filename')}
                    onChange={(event) => {
                        const next = event.target.value
                        setName(next)
                        updateNode((node) => node?.setFilename(next))
                    }}
                    placeholder="File name"
                    spellCheck={false}
                    type="text"
                    value={name}
                />
                <div className="notion-code-block__actions">
                    <button
                        aria-label={copied ? 'Copied' : 'Copy code'}
                        className={`note-view__codeblock-copy notion-code-block__action${copied ? ' note-view__codeblock-copy--copied' : ''}`}
                        onClick={() => void onCopy()}
                        type="button"
                    >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                        aria-label="Delete code block"
                        className="note-view__codeblock-copy notion-code-block__action"
                        onClick={() => updateNode((node) => node?.remove())}
                        type="button"
                    >
                        <TrashIcon />
                    </button>
                </div>
            </div>
            <div className="notion-code-block__body">
                {/* highlight.js output: only <span class="hljs-*"> and escaped text */}
                <pre aria-hidden="true" className="notion-code-block__highlight">
                    <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
                </pre>
                <textarea
                    aria-label={`Code (${languageLabel})`}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    className="notion-code-block__input"
                    data-testid="notion-code-input"
                    onBlur={() => setFocused(null)}
                    onChange={(event) => writeCode(event.target.value)}
                    onFocus={() => setFocused('code')}
                    onKeyDown={onKeyDown}
                    placeholder="Write some code…"
                    ref={textareaRef}
                    spellCheck={false}
                    value={text}
                    wrap="soft"
                />
            </div>
        </div>
    )
}

function getCodeBlock(nodeKey: NodeKey) {
    const node = $getNodeByKey(nodeKey)
    return $isCodeBlockServerNode(node) ? node : null
}

