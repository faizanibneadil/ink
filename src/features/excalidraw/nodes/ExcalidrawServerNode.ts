import type {
    EditorConfig,
    LexicalCommand,
    LexicalNode,
    NodeKey,
    SerializedLexicalNode,
    Spread,
} from '@payloadcms/richtext-lexical/lexical'
import type React from 'react'

import { $applyNodeReplacement, createCommand, DecoratorNode } from '@payloadcms/richtext-lexical/lexical'

import { EMPTY_SCENE_DATA } from '../scene'

export const EXCALIDRAW_NODE_TYPE = 'excalidraw'

export type SerializedExcalidrawNode = Spread<
    {
        /** Drawing as a JSON string (`{ elements, appState, files }`), see `scene.ts` */
        data: string
        type: typeof EXCALIDRAW_NODE_TYPE
    },
    SerializedLexicalNode
>

export const INSERT_EXCALIDRAW_COMMAND: LexicalCommand<void> = createCommand('INSERT_EXCALIDRAW_COMMAND')

/**
 * Excalidraw drawing node, without any React rendering (`decorate()` returns null), so it can be
 * used on the server (validation, hooks, HTML / headless conversion).
 * The client editor uses `ExcalidrawNode`, which extends this class and renders the drawing.
 */
export class ExcalidrawServerNode extends DecoratorNode<null | React.ReactElement> {
    __data: string

    constructor(data: string = EMPTY_SCENE_DATA, key?: NodeKey) {
        super(key)
        this.__data = data
    }

    static clone(node: ExcalidrawServerNode): ExcalidrawServerNode {
        return new this(node.__data, node.__key)
    }

    static getType(): string {
        return EXCALIDRAW_NODE_TYPE
    }

    static importJSON(serializedNode: SerializedExcalidrawNode): ExcalidrawServerNode {
        return $createExcalidrawServerNode(
            typeof serializedNode.data === 'string' ? serializedNode.data : EMPTY_SCENE_DATA,
        )
    }

    createDOM(_config: EditorConfig): HTMLElement {
        const element = document.createElement('div')
        element.className = 'ink-excalidraw-node'
        return element
    }

    decorate(): null | React.ReactElement {
        return null
    }

    exportJSON(): SerializedExcalidrawNode {
        return {
            ...super.exportJSON(),
            type: EXCALIDRAW_NODE_TYPE,
            data: this.getData(),
            version: 1,
        }
    }

    getData(): string {
        return this.getLatest().__data
    }

    getTextContent(): string {
        return '\n'
    }

    isInline(): false {
        return false
    }

    setData(data: string): void {
        const writable = this.getWritable()
        writable.__data = data
    }

    updateDOM(): boolean {
        return false
    }
}

export function $createExcalidrawServerNode(data: string = EMPTY_SCENE_DATA): ExcalidrawServerNode {
    return $applyNodeReplacement(new ExcalidrawServerNode(data))
}

export function $isExcalidrawServerNode(node: LexicalNode | null | undefined): node is ExcalidrawServerNode {
    return node instanceof ExcalidrawServerNode
}
