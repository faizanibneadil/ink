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

import { type CodeLanguage, DEFAULT_CODE_LANGUAGE, isCodeLanguage } from '../shared/languages'

export const CODE_BLOCK_NODE_TYPE = 'code-block'

export type SerializedCodeBlockNode = Spread<
    {
        code: string
        /** Optional file name shown in the block header (e.g. `app.tsx`), empty when not set */
        filename?: string
        /** Key of `codeLanguages` (../shared/languages.ts) */
        language: string
        type: typeof CODE_BLOCK_NODE_TYPE
    },
    SerializedLexicalNode
>

export type InsertCodeBlockPayload = {
    code?: string
    filename?: string
    language?: CodeLanguage
}

export const INSERT_CODE_BLOCK_COMMAND: LexicalCommand<InsertCodeBlockPayload | undefined> =
    createCommand('INSERT_CODE_BLOCK_COMMAND')

const toLanguage = (value: unknown): CodeLanguage => (isCodeLanguage(value) ? value : DEFAULT_CODE_LANGUAGE)

/**
 * Native code block node: `{ code, language, filename }` saved inline in the rich text JSON (no Payload block,
 * no form state, no server request). Renders nothing (`decorate()` returns null), so it can be used on
 * the server (validation, hooks, HTML / headless conversion).
 * The client editor uses `CodeBlockNode`, which extends this class and renders the Monaco editor.
 */
export class CodeBlockServerNode extends DecoratorNode<null | React.ReactElement> {
    __code: string
    __filename: string
    __language: CodeLanguage

    constructor(code: string = '', language: CodeLanguage = DEFAULT_CODE_LANGUAGE, filename: string = '', key?: NodeKey) {
        super(key)
        this.__code = code
        this.__language = language
        this.__filename = filename
    }

    static clone(node: CodeBlockServerNode): CodeBlockServerNode {
        return new this(node.__code, node.__language, node.__filename, node.__key)
    }

    static getType(): string {
        return CODE_BLOCK_NODE_TYPE
    }

    static importJSON(serializedNode: SerializedCodeBlockNode): CodeBlockServerNode {
        return $createCodeBlockServerNode({
            code: typeof serializedNode.code === 'string' ? serializedNode.code : '',
            filename: typeof serializedNode.filename === 'string' ? serializedNode.filename : '',
            language: toLanguage(serializedNode.language),
        })
    }

    createDOM(_config: EditorConfig): HTMLElement {
        const element = document.createElement('div')
        element.className = 'ink-code-block-node'
        return element
    }

    decorate(): null | React.ReactElement {
        return null
    }

    exportJSON(): SerializedCodeBlockNode {
        return {
            ...super.exportJSON(),
            type: CODE_BLOCK_NODE_TYPE,
            code: this.getCode(),
            filename: this.getFilename(),
            language: this.getLanguage(),
            version: 1,
        }
    }

    getCode(): string {
        return this.getLatest().__code
    }

    getFilename(): string {
        return this.getLatest().__filename
    }

    getLanguage(): CodeLanguage {
        return this.getLatest().__language
    }

    getTextContent(): string {
        return this.getCode()
    }

    isInline(): false {
        return false
    }

    setCode(code: string): void {
        const writable = this.getWritable()
        writable.__code = code
    }

    setFilename(filename: string): void {
        const writable = this.getWritable()
        writable.__filename = filename
    }

    setLanguage(language: CodeLanguage): void {
        const writable = this.getWritable()
        writable.__language = language
    }

    updateDOM(): boolean {
        return false
    }
}

export function $createCodeBlockServerNode({ code, filename, language }: InsertCodeBlockPayload = {}): CodeBlockServerNode {
    return $applyNodeReplacement(new CodeBlockServerNode(code, language, filename))
}

export function $isCodeBlockServerNode(node: LexicalNode | null | undefined): node is CodeBlockServerNode {
    return node instanceof CodeBlockServerNode
}
