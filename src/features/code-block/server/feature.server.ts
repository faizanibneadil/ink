import { createNode, createServerFeature } from '@payloadcms/richtext-lexical'

import { codeLanguages } from '../shared/languages'
import { CODE_BLOCK_NODE_TYPE, CodeBlockServerNode } from './CodeBlockServerNode'

/** Must stay in sync with `SerializedCodeBlockNode` in ./CodeBlockServerNode.ts */
const SERIALIZED_CODE_BLOCK_NODE_TS = `export interface SerializedCodeBlockNode {
  type: 'code-block';
  code: string;
  filename?: string;
  language: string;
  version: number;
}`

/**
 * Native Lexical code block feature (no Payload block, nothing loaded from the database).
 * Adds "Code Block" to the slash menu, the toolbar's "+" dropdown and the ``` markdown shortcut.
 * The editor is Monaco (Payload's `CodeEditor`), the code is stored inline in the rich text JSON.
 */
export const CodeBlockFeature = createServerFeature({
    feature: {
        ClientFeature: '@/features/code-block/client/feature.client#CodeBlockFeatureClient',
        i18n: {
            en: {
                label: 'Code Block',
            },
        },
        nodes: [
            createNode({
                jsonSchema: ({ typeStringDefinitions }) => {
                    typeStringDefinitions.add(SERIALIZED_CODE_BLOCK_NODE_TS)
                    return {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            type: { type: 'string', const: CODE_BLOCK_NODE_TYPE },
                            code: { type: 'string' },
                            filename: { type: 'string' },
                            language: { type: 'string', enum: Object.keys(codeLanguages) },
                            version: { type: 'integer' },
                        },
                        required: ['type', 'code', 'language'],
                        tsType: 'SerializedCodeBlockNode',
                    }
                },
                node: CodeBlockServerNode,
            }),
        ],
    },
    key: 'codeBlock',
})
