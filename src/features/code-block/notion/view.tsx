'use client'

import type { NodeMapValue } from '@payloadcms/richtext-lexical'

import { lazy, Suspense } from 'react'

import type { CodeBlockServerNode, SerializedCodeBlockNode } from '../server/CodeBlockServerNode'
import { CodeBlockFrame, plainLines } from '../viewer/CodeBlockFrame'

// Loaded only when a note has a code block: the editable block, and highlight.js with it. This module is in every
// Payload page's bundle (src/views/config.tsx is in the import map), so it must not import highlight.js itself.
const NotionCodeBlock = lazy(() => import('./NotionCodeBlock').then((module) => ({ default: module.NotionCodeBlock })))
const CodeBlockView = lazy(() => import('../viewer/CodeBlockView').then((module) => ({ default: module.CodeBlockView })))

type BlockProps = { code: string, filename?: null | string, language?: null | string }

/** Same block without colours, while the chunk with highlight.js loads (same lines as highlight.js' plain output). */
const PlainCodeBlock: React.FC<BlockProps> = ({ code, filename, language }) => (
    <CodeBlockFrame code={code} filename={filename} language={language} lines={plainLines(code)} />
)

/**
 * `code-block` in the Lexical `notion` view (src/views/config.tsx):
 * - editor (note page): the Notion-style editable block instead of Monaco
 * - JSX converter in a client tree: the read-only block (the guest note view renders on the server instead,
 *   src/views/note-viewer.tsx)
 *
 * Payload calls `Component` as a plain function inside the node's `decorate()` / the converter, not as a React
 * component, so it must not use hooks: it only returns elements, and the hooks live in NotionCodeBlock.
 */
export const notionCodeBlockNode: NodeMapValue<SerializedCodeBlockNode> = {
    Component: (args) => {
        if (args.isEditor) {
            // Fields are read directly (like CodeBlockNode.decorate): decorate() runs outside an editor read
            const node = args.node as unknown as CodeBlockServerNode
            const fallback = <PlainCodeBlock code={node.__code} filename={node.__filename} language={node.__language} />
            return (
                <Suspense fallback={fallback}>
                    <NotionCodeBlock
                        code={node.__code}
                        filename={node.__filename}
                        language={node.__language}
                        nodeKey={node.getKey()}
                    />
                </Suspense>
            )
        }
        const { node } = args
        const props = { code: node.code ?? '', filename: node.filename, language: node.language }
        return (
            <Suspense fallback={<PlainCodeBlock {...props} />}>
                <CodeBlockView {...props} />
            </Suspense>
        )
    },
}
