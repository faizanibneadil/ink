'use client'

import type { JSXConverters } from '@payloadcms/richtext-lexical/react'

import type { SerializedCodeBlockNode } from '../server/CodeBlockServerNode'
import { CodeBlockView } from './CodeBlockView'

export type CodeBlockViewerNodeTypes = SerializedCodeBlockNode

/** Read-only note view converter: the code block renders with the Notion-style `CodeBlockView`. */
export const codeBlockConverters: JSXConverters<CodeBlockViewerNodeTypes> = {
    'code-block': ({ node }) => (
        <CodeBlockView code={node.code ?? ''} filename={node.filename} language={node.language} />
    ),
}
