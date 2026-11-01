'use client'

import type { LexicalNode } from '@payloadcms/richtext-lexical/lexical'

import { $applyNodeReplacement } from '@payloadcms/richtext-lexical/lexical'
import React from 'react'

import { EMPTY_SCENE_DATA } from '../scene'
import { ExcalidrawServerNode, type SerializedExcalidrawNode } from './ExcalidrawServerNode'

// Loaded only when a drawing node is in the editor
const ExcalidrawComponent = React.lazy(() =>
    import('../components/ExcalidrawComponent').then((module) => ({ default: module.ExcalidrawComponent })),
)

/** Client (editor) version of the node: renders the drawing with Edit / Delete buttons. */
export class ExcalidrawNode extends ExcalidrawServerNode {
    static clone(node: ExcalidrawNode): ExcalidrawNode {
        return new ExcalidrawNode(node.__data, node.__key)
    }

    static getType(): string {
        return super.getType()
    }

    static importJSON(serializedNode: SerializedExcalidrawNode): ExcalidrawNode {
        return $createExcalidrawNode(
            typeof serializedNode.data === 'string' ? serializedNode.data : EMPTY_SCENE_DATA,
        )
    }

    decorate(): React.ReactElement {
        return <ExcalidrawComponent data={this.__data} nodeKey={this.getKey()} />
    }

    exportJSON(): SerializedExcalidrawNode {
        return super.exportJSON()
    }
}

export function $createExcalidrawNode(data: string = EMPTY_SCENE_DATA): ExcalidrawNode {
    return $applyNodeReplacement(new ExcalidrawNode(data))
}

export function $isExcalidrawNode(node: LexicalNode | null | undefined): node is ExcalidrawNode {
    return node instanceof ExcalidrawNode
}
