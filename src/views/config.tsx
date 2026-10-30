'use client'
import type {
    DefaultNodeTypes,
    LexicalEditorViewMap,
    SerializedBlockNode,
} from '@payloadcms/richtext-lexical'
import type { CodeBlock, WhiteboardBlockPropsType } from '@/payload-types'

type NodeTypes =
    | DefaultNodeTypes
    | SerializedBlockNode<WhiteboardBlockPropsType | CodeBlock>

export const views: LexicalEditorViewMap<NodeTypes> = {
    default: {
        nodes: {}
    },
}