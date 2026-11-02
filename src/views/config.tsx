'use client'
import type {
    DefaultNodeTypes,
    LexicalEditorViewMap,
    SerializedBlockNode,
} from '@payloadcms/richtext-lexical'
import type { SerializedCodeBlockNode } from '@/features/code-block'
import type { SerializedExcalidrawNode } from '@/features/excalidraw'
import type { CodeBlock } from '@/payload-types'

type NodeTypes =
    | DefaultNodeTypes
    | SerializedBlockNode<CodeBlock>
    | SerializedCodeBlockNode
    | SerializedExcalidrawNode

export const views: LexicalEditorViewMap<NodeTypes> = {
    default: {
        nodes: {}
    },
}
