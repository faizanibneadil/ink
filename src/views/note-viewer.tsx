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

// Payload's Lexical editor CSS. The editor loads it only when it renders, so the read-only view imports it
// itself (aliased to the file inside the package in next.config.ts).
import '@payloadcms/richtext-lexical/bundled.css'

import { views } from './config'

// `views` comes from a 'use client' module, so it can only be read on the client.
// Reading it in the server component (note.tsx) gives an RSC client reference where `views.default` is undefined.

// Class names Payload's Lexical editor puts on its nodes (`LexicalEditorTheme` in
// @payloadcms/richtext-lexical/dist/lexical/theme/EditorTheme.js). Payload's editor CSS only targets
// these, so the converters below emit them to get the same styling as the editor, without custom CSS.
const theme = {
    root: 'LexicalEditorTheme',
    paragraph: 'LexicalEditorTheme__paragraph',
    quote: 'LexicalEditorTheme__quote',
    heading: 'LexicalEditorTheme__',
    hr: 'LexicalEditorTheme__hr',
    link: 'LexicalEditorTheme__link',
    tab: 'LexicalEditorTheme__tabNode',
    list: {
        checklist: 'LexicalEditorTheme__checklist',
        listitem: 'LexicalEditorTheme__listItem',
        listitemChecked: 'LexicalEditorTheme__listItemChecked',
        listitemUnchecked: 'LexicalEditorTheme__listItemUnchecked',
        nestedListitem: 'LexicalEditorTheme__nestedListItem',
        ol: 'LexicalEditorTheme__ol1',
        ul: 'LexicalEditorTheme__ul',
    },
    table: {
        wrapper: 'LexicalEditorTheme__tableScrollableWrapper',
        table: 'LexicalEditorTheme__table',
        cell: 'LexicalEditorTheme__tableCell',
        cellHeader: 'LexicalEditorTheme__tableCellHeader',
    },
    text: {
        bold: 'LexicalEditorTheme__textBold',
        code: 'LexicalEditorTheme__textCode',
        italic: 'LexicalEditorTheme__textItalic',
        strikethrough: 'LexicalEditorTheme__textStrikethrough',
        subscript: 'LexicalEditorTheme__textSubscript',
        superscript: 'LexicalEditorTheme__textSuperscript',
        underline: 'LexicalEditorTheme__textUnderline',
        underlineStrikethrough: 'LexicalEditorTheme__textUnderlineStrikethrough',
    },
}

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
        return <p className={theme.paragraph}>{children?.length ? children : <br />}</p>
    },
    heading: ({ node, nodesToJSX }) => {
        const Tag = node.tag
        return <Tag className={`${theme.heading}${node.tag}`}>{nodesToJSX({ nodes: node.children })}</Tag>
    },
    quote: ({ node, nodesToJSX }) => (
        <blockquote className={theme.quote}>{nodesToJSX({ nodes: node.children })}</blockquote>
    ),
    horizontalrule: () => <hr className={theme.hr} />,
    tab: ({ node }) => <span className={theme.tab}>{node.text}</span>,
    text: ({ node }) => {
        const format = node.format
        const underline = Boolean(format & IS_UNDERLINE)
        const strikethrough = Boolean(format & IS_STRIKETHROUGH)
        const className = cx(
            format & IS_BOLD && theme.text.bold,
            format & IS_ITALIC && theme.text.italic,
            format & IS_CODE && theme.text.code,
            format & IS_SUBSCRIPT && theme.text.subscript,
            format & IS_SUPERSCRIPT && theme.text.superscript,
            underline && strikethrough ? theme.text.underlineStrikethrough : cx(
                underline && theme.text.underline,
                strikethrough && theme.text.strikethrough,
            ),
        )
        if (!className) {
            return node.text
        }
        // Same tags Lexical's TextNode uses
        const Tag = format & IS_CODE ? 'code'
            : format & IS_SUBSCRIPT ? 'sub'
            : format & IS_SUPERSCRIPT ? 'sup'
            : format & IS_BOLD ? 'strong'
            : format & IS_ITALIC ? 'em'
            : 'span'
        return <Tag className={className}>{node.text}</Tag>
    },
    link: ({ node, nodesToJSX }) => {
        const doc = node.fields.doc
        const href = node.fields.linkType === 'internal'
            ? (doc && typeof doc.value === 'object' ? `/admin/collections/${doc.relationTo}/${doc.value.id}` : '#')
            : node.fields.url ?? ''
        return (
            <a
                className={theme.link}
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
            className={theme.link}
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
            return <ol className={theme.list.ol} start={node.start !== 1 ? node.start : undefined}>{children}</ol>
        }
        return <ul className={cx(theme.list.ul, node.listType === 'check' && theme.list.checklist)}>{children}</ul>
    },
    listitem: ({ node, nodesToJSX, parent }) => {
        const isChecklist = (parent as SerializedListNode).listType === 'check'
        const hasSubLists = node.children.some((child) => child.type === 'list')
        const item = node as SerializedListItemNode
        return (
            <li
                aria-checked={isChecklist && !hasSubLists ? (item.checked ? 'true' : 'false') : undefined}
                className={cx(
                    theme.list.listitem,
                    hasSubLists && theme.list.nestedListitem,
                    isChecklist && !hasSubLists && (item.checked ? theme.list.listitemChecked : theme.list.listitemUnchecked),
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
            <div className={theme.table.wrapper}>
                <table className={theme.table.table}>
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
        const Tag = node.headerState > 0 ? 'th' : 'td'
        return (
            <Tag
                className={cx(theme.table.cell, node.headerState > 0 && theme.table.cellHeader)}
                colSpan={node.colSpan && node.colSpan > 1 ? node.colSpan : undefined}
                rowSpan={node.rowSpan && node.rowSpan > 1 ? node.rowSpan : undefined}
                style={node.backgroundColor ? { backgroundColor: node.backgroundColor } : undefined}
            >
                {nodesToJSX({ nodes: node.children })}
            </Tag>
        )
    },
}

type NodeTypes = DefaultNodeTypes | SerializedBlockNode<CodeBlock>

const converters: JSXConvertersFunction<NodeTypes> = ({ defaultConverters }) => ({
    ...defaultConverters,
    ...editorThemeConverters,
    blocks: {
        // Lightweight read-only code block: preformatted code, no editor / highlighter
        CodeBlock: ({ node }) => (
            <div className="note-code-block">
                {node.fields.language ? <div className="note-code-block__language">{node.fields.language}</div> : null}
                <pre className="note-code-block__pre"><code>{node.fields.code ?? ''}</code></pre>
            </div>
        ),
    },
})

export const NoteViewer: React.FC<{ note: Note['note'] }> = ({ note }) => {
    return (
        <RichText
            className={theme.root}
            converters={converters}
            data={note as DefaultTypedEditorState}
            nodeMap={views.default.nodes}
        />
    )
}
