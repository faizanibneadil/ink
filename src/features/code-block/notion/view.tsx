'use client'

import type { NodeMapValue } from '@payloadcms/richtext-lexical'

import { lazy, Suspense } from 'react'

import type { CodeBlockServerNode, SerializedCodeBlockNode } from '../server/CodeBlockServerNode'
import { CodeBlockView } from '../viewer/CodeBlockView'

// Only the note page editor downloads the editable block; guests get the read-only one
const NotionCodeBlock = lazy(() => import('./NotionCodeBlock').then((module) => ({ default: module.NotionCodeBlock })))

/**
 * `code-block` in the Lexical `notion` view (src/views/config.tsx):
 * - editor (note page): the Notion-style editable block instead of Monaco
 * - JSX converter (read-only note page): the read-only block
 *
 * Payload calls `Component` as a plain function inside the node's `decorate()` / the converter, not as a React
 * component, so it must not use hooks: it only returns elements, and the hooks live in NotionCodeBlock.
 */
export const notionCodeBlockNode: NodeMapValue<SerializedCodeBlockNode> = {
    Component: (args) => {
        if (args.isEditor) {
            // Fields are read directly (like CodeBlockNode.decorate): decorate() runs outside an editor read
            const node = args.node as unknown as CodeBlockServerNode
            const fallback = <CodeBlockView code={node.__code} filename={node.__filename} language={node.__language} />
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
        return <CodeBlockView code={node.code ?? ''} filename={node.filename} language={node.language} />
    },
}
