'use client'
import type {
    DefaultNodeTypes,
    LexicalEditorViewMap,
    SerializedBlockNode,
} from '@payloadcms/richtext-lexical'
import type { CodeBlock } from '@/payload-types'

type NodeTypes =
    | DefaultNodeTypes
    | SerializedBlockNode<CodeBlock>

export const views: LexicalEditorViewMap<NodeTypes> = {
    default: {
        nodes: {}
    },
}