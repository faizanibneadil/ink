'use client'

import type { LexicalNode } from '@payloadcms/richtext-lexical/lexical'

import { $applyNodeReplacement } from '@payloadcms/richtext-lexical/lexical'
import React from 'react'

import {
    CodeBlockServerNode,
    type InsertCodeBlockPayload,
    type SerializedCodeBlockNode,
} from '../server/CodeBlockServerNode'
import { DEFAULT_CODE_LANGUAGE, isCodeLanguage } from '../shared/languages'

// Monaco + the block UI are loaded only when a code block is in the editor
const CodeBlockComponent = React.lazy(() =>
    import('../editor/CodeBlockComponent').then((module) => ({ default: module.CodeBlockComponent })),
)

/** Client (editor) version of the node: renders the code block with the Monaco editor. */
export class CodeBlockNode extends CodeBlockServerNode {
    static clone(node: CodeBlockNode): CodeBlockNode {
        return new CodeBlockNode(node.__code, node.__language, node.__filename, node.__key)
    }

    static getType(): string {
        return super.getType()
    }

    static importJSON(serializedNode: SerializedCodeBlockNode): CodeBlockNode {
        return $createCodeBlockNode({
            code: typeof serializedNode.code === 'string' ? serializedNode.code : '',
            filename: typeof serializedNode.filename === 'string' ? serializedNode.filename : '',
            language: isCodeLanguage(serializedNode.language) ? serializedNode.language : DEFAULT_CODE_LANGUAGE,
        })
    }

    decorate(): React.ReactElement {
        return (
            <CodeBlockComponent
                code={this.__code}
                filename={this.__filename}
                language={this.__language}
                nodeKey={this.getKey()}
            />
        )
    }

    exportJSON(): SerializedCodeBlockNode {
        return super.exportJSON()
    }
}

export function $createCodeBlockNode({ code, filename, language }: InsertCodeBlockPayload = {}): CodeBlockNode {
    return $applyNodeReplacement(new CodeBlockNode(code, language, filename))
}

export function $isCodeBlockNode(node: LexicalNode | null | undefined): node is CodeBlockNode {
    return node instanceof CodeBlockNode
}
