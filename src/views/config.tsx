'use client'
import type {
    DefaultNodeTypes,
    LexicalEditorViewMap,
} from '@payloadcms/richtext-lexical'
import type { SerializedCodeBlockNode } from '@/features/code-block'
import type { SerializedExcalidrawNode } from '@/features/excalidraw'

type NodeTypes =
    | DefaultNodeTypes
    | SerializedCodeBlockNode
    | SerializedExcalidrawNode

export const views: LexicalEditorViewMap<NodeTypes> = {
    default: {
        nodes: {}
    },
}
