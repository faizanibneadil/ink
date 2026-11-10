import type {
    DefaultNodeTypes,
    DefaultTypedEditorState,
    SerializedListItemNode,
    SerializedListNode,
} from '@payloadcms/richtext-lexical'
import type { JSXConverters, JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import type { Note } from '@/payload-types'

import { RichText } from '@payloadcms/richtext-lexical/react'

import { codeBlockConverters, type CodeBlockViewerNodeTypes } from '@/features/code-block/viewer/converter'
import { excalidrawConverters, type ExcalidrawViewerNodeTypes } from '@/features/excalidraw/viewer/converter'

import type { NoteHeaderData } from './note-header/header-data'
import { NoteHeader } from './note-header/NoteHeader'
import { tableColumnWidths } from './table-columns'

// Notion-style read-only styles. Only styles elements inside `.note-page` / `.note-view`.
import './note-viewer.css'

// A Server Component: the read-only note is plain HTML, so its converters, Lexical's JSX renderer and highlight.js run
// on the server only. Client islands: the code block's Copy button and the drawings (ExcalidrawViewer).
// No `nodeMap` from ./config.tsx (a 'use client' module, unreadable here): its only entry, the notion view's
// `code-block`, renders the same CodeBlockView as `codeBlockConverters` in a read-only tree.

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
            ? (doc && typeof doc.value === 'object' ? `/collections/${doc.relationTo}/${doc.value.id}` : '#')
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
        // Saved by Lexical's table node but missing from Payload's serialized node type
        const { frozenColumnCount, rowStriping } = node as { frozenColumnCount?: number; rowStriping?: boolean }
        // The widths the editor shows (./table-columns.ts)
        const widths = tableColumnWidths(node as Parameters<typeof tableColumnWidths>[0])
        const className = [
            'note-view__table',
            rowStriping && 'note-view__table--striped',
            frozenColumnCount && frozenColumnCount > 0 && 'note-view__table--frozen-column',
            // Lexical aligns a table only to the center or the right (like the editor's `tableAlignment` theme)
            (node.format === 'center' || node.format === 'right') && `note-view__table--${node.format}`,
        ]
            .filter(Boolean)
            .join(' ')
        return (
            <div className="note-view__table-scroll">
                <table className={className}>
                    {/* Column widths, like Lexical's own <colgroup> in the editor */}
                    {widths.length ? (
                        <colgroup>
                            {widths.map((width, index) => (
                                <col key={index} style={width ? { width } : undefined} />
                            ))}
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

type NodeTypes = DefaultNodeTypes | CodeBlockViewerNodeTypes | ExcalidrawViewerNodeTypes

// Each feature brings its own read-only converters (src/features/<feature>/viewer/converter.tsx)
const converters: JSXConvertersFunction<NodeTypes> = ({ defaultConverters }) => ({
    ...defaultConverters,
    ...editorThemeConverters,
    ...excalidrawConverters,
    ...codeBlockConverters,
})

export const NoteViewer: React.FC<{ header: NoteHeaderData, note: Note['note'] }> = ({ header, note }) => {
    return (
        <article className="note-doc">
            <NoteHeader header={header} />
            <div className="note-page">
                <RichText
                    className="note-view"
                    converters={converters}
                    data={note as DefaultTypedEditorState}
                />
            </div>
        </article>
    )
}
