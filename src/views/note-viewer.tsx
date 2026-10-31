'use client'

import type {
    DefaultNodeTypes,
    DefaultTypedEditorState,
    SerializedBlockNode,
    SerializedListItemNode,
    SerializedListNode,
} from '@payloadcms/richtext-lexical'
import type { JSXConverters, JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import type { CodeBlock, Note } from '@/payload-types'

import { RichText } from '@payloadcms/richtext-lexical/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { codeLanguages } from '@/blocks/code/languages'

import { views } from './config'
import { highlightLines } from './highlight'

// Notion-style read-only styles. Only styles elements inside `.note-page` / `.note-view`.
import './note-viewer.css'

// `views` comes from a 'use client' module, so it can only be read on the client.
// Reading it in the server component (note.tsx) gives an RSC client reference where `views.default` is undefined.

// Lexical text format bit flags
const IS_BOLD = 1
const IS_ITALIC = 1 << 1
const IS_STRIKETHROUGH = 1 << 2
const IS_UNDERLINE = 1 << 3
const IS_CODE = 1 << 4
const IS_SUBSCRIPT = 1 << 5
const IS_SUPERSCRIPT = 1 << 6

const cx = (...classes: (0 | false | null | string | undefined)[]) => classes.filter(Boolean).join(' ')

const editorThemeConverters: JSXConverters<DefaultNodeTypes> = {
    paragraph: ({ node, nodesToJSX }) => {
        const children = nodesToJSX({ nodes: node.children })
        return <p className="note-view__p">{children?.length ? children : <br />}</p>
    },
    heading: ({ node, nodesToJSX }) => {
        const Tag = node.tag
        return <Tag className={`note-view__${node.tag}`}>{nodesToJSX({ nodes: node.children })}</Tag>
    },
    quote: ({ node, nodesToJSX }) => (
        <blockquote className="note-view__quote">{nodesToJSX({ nodes: node.children })}</blockquote>
    ),
    horizontalrule: () => <hr className="note-view__hr" />,
    tab: ({ node }) => <span className="note-view__tab">{node.text}</span>,
    text: ({ node }) => {
        const format = node.format
        const className = cx(
            format & IS_BOLD && 'note-view__bold',
            format & IS_ITALIC && 'note-view__italic',
            format & IS_CODE && 'note-view__code',
            format & IS_UNDERLINE && 'note-view__underline',
            format & IS_STRIKETHROUGH && 'note-view__strike',
        )
        const isSub = Boolean(format & IS_SUBSCRIPT)
        const isSup = Boolean(format & IS_SUPERSCRIPT)
        if (!className && !isSub && !isSup) {
            return node.text
        }
        // Same tags Lexical's TextNode uses
        const Tag = format & IS_CODE ? 'code'
            : isSub ? 'sub'
            : isSup ? 'sup'
            : format & IS_BOLD ? 'strong'
            : format & IS_ITALIC ? 'em'
            : 'span'
        return <Tag className={className || undefined}>{node.text}</Tag>
    },
    link: ({ node, nodesToJSX }) => {
        const doc = node.fields.doc
        const href = node.fields.linkType === 'internal'
            ? (doc && typeof doc.value === 'object' ? `/admin/collections/${doc.relationTo}/${doc.value.id}` : '#')
            : node.fields.url ?? ''
        return (
            <a
                className="note-view__link"
                href={href}
                rel={node.fields.newTab ? 'noopener noreferrer' : undefined}
                target={node.fields.newTab ? '_blank' : undefined}
            >
                {nodesToJSX({ nodes: node.children })}
            </a>
        )
    },
    autolink: ({ node, nodesToJSX }) => (
        <a
            className="note-view__link"
            href={node.fields.url}
            rel={node.fields.newTab ? 'noopener noreferrer' : undefined}
            target={node.fields.newTab ? '_blank' : undefined}
        >
            {nodesToJSX({ nodes: node.children })}
        </a>
    ),
    list: ({ node, nodesToJSX }) => {
        const children = nodesToJSX({ nodes: node.children })
        if (node.tag === 'ol') {
            return <ol className="note-view__ol" start={node.start !== 1 ? node.start : undefined}>{children}</ol>
        }
        return <ul className={cx('note-view__ul', node.listType === 'check' && 'note-view__checklist')}>{children}</ul>
    },
    listitem: ({ node, nodesToJSX, parent }) => {
        const isChecklist = (parent as SerializedListNode).listType === 'check'
        const hasSubLists = node.children.some((child) => child.type === 'list')
        const item = node as SerializedListItemNode
        return (
            <li
                aria-checked={isChecklist && !hasSubLists ? (item.checked ? 'true' : 'false') : undefined}
                className={cx(
                    'note-view__li',
                    hasSubLists && 'note-view__li--nested',
                    isChecklist && !hasSubLists && (item.checked ? 'note-view__li--checked' : 'note-view__li--unchecked'),
                )}
                role={isChecklist && !hasSubLists ? 'checkbox' : undefined}
                value={item.value}
            >
                {nodesToJSX({ nodes: node.children })}
            </li>
        )
    },
    table: ({ node, nodesToJSX }) => {
        // `colWidths` is saved by the table feature but missing from the default node types
        const colWidths = (node as { colWidths?: number[] }).colWidths
        return (
            <div className="note-view__table-scroll">
                <table className="note-view__table">
                    {/* Column widths set in the editor, like Lexical's own <colgroup> */}
                    {colWidths?.length ? (
                        <colgroup>
                            {colWidths.map((width, index) => <col key={index} style={{ width }} />)}
                        </colgroup>
                    ) : null}
                    <tbody>{nodesToJSX({ nodes: node.children })}</tbody>
                </table>
            </div>
        )
    },
    tablerow: ({ node, nodesToJSX }) => <tr>{nodesToJSX({ nodes: node.children })}</tr>,
    tablecell: ({ node, nodesToJSX }) => {
        const isHeader = node.headerState > 0
        const Tag = isHeader ? 'th' : 'td'
        return (
            <Tag
                className={isHeader ? 'note-view__th' : 'note-view__td'}
                colSpan={node.colSpan && node.colSpan > 1 ? node.colSpan : undefined}
                rowSpan={node.rowSpan && node.rowSpan > 1 ? node.rowSpan : undefined}
                style={node.backgroundColor ? { backgroundColor: node.backgroundColor } : undefined}
            >
                {nodesToJSX({ nodes: node.children })}
            </Tag>
        )
    },
}

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

const CodeBlockView: React.FC<{ code: string, language?: null | string }> = ({ code, language }) => {
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

type NodeTypes = DefaultNodeTypes | SerializedBlockNode<CodeBlock>

const converters: JSXConvertersFunction<NodeTypes> = ({ defaultConverters }) => ({
    ...defaultConverters,
    ...editorThemeConverters,
    blocks: {
        // Read-only code block: line numbers + syntax highlighting (highlight.js), no editor
        CodeBlock: ({ node }) => <CodeBlockView code={node.fields.code ?? ''} language={node.fields.language} />,
    },
})

export const NoteViewer: React.FC<{ note: Note['note'] }> = ({ note }) => {
    return (
        <div className="note-page">
            <RichText
                className="note-view"
                converters={converters}
                data={note as DefaultTypedEditorState}
                nodeMap={views.default.nodes}
            />
        </div>
    )
}
