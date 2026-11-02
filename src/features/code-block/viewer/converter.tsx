'use client'

import type { SerializedBlockNode } from '@payloadcms/richtext-lexical'
import type { JSXConverters } from '@payloadcms/richtext-lexical/react'
import type { CodeBlock } from '@/payload-types'

import type { SerializedCodeBlockNode } from '../server/CodeBlockServerNode'
import { CodeBlockView } from './CodeBlockView'

export type CodeBlockViewerNodeTypes = SerializedBlockNode<CodeBlock> | SerializedCodeBlockNode

/**
 * Read-only note view converters: the native code block (`code-block` node) and the legacy Payload
 * `CodeBlock` block both render with the same Notion-style `CodeBlockView`.
 */
export const codeBlockConverters: JSXConverters<CodeBlockViewerNodeTypes> = {
    'code-block': ({ node }) => (
        <CodeBlockView code={node.code ?? ''} filename={node.filename} language={node.language} />
    ),
    blocks: {
        // Legacy block ("Code (Legacy)"), kept until it is removed
        CodeBlock: ({ node }) => <CodeBlockView code={node.fields.code ?? ''} language={node.fields.language} />,
    },
}
