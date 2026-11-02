import { createNode, createServerFeature } from '@payloadcms/richtext-lexical'

import { EXCALIDRAW_NODE_TYPE, ExcalidrawServerNode } from './nodes/ExcalidrawServerNode'

/** Must stay in sync with `SerializedExcalidrawNode` in ./nodes/ExcalidrawServerNode.ts */
const SERIALIZED_EXCALIDRAW_NODE_TS = `export interface SerializedExcalidrawNode {
  type: 'excalidraw';
  /** Drawing as a JSON string: { elements, appState, files } */
  data: string;
  version: number;
}`

/**
 * Native Lexical Excalidraw feature (no Payload block). Adds a "Drawing" item to the slash menu
 * and to the toolbar's "+" dropdown. The drawing is stored inline in the rich text JSON.
 */
export const ExcalidrawFeature = createServerFeature({
    feature: {
        ClientFeature: '@/features/excalidraw/feature.client#ExcalidrawFeatureClient',
        i18n: {
            en: {
                label: 'Drawing',
            },
        },
        nodes: [
            createNode({
                jsonSchema: ({ typeStringDefinitions }) => {
                    typeStringDefinitions.add(SERIALIZED_EXCALIDRAW_NODE_TS)
                    return {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            type: { type: 'string', const: EXCALIDRAW_NODE_TYPE },
                            data: { type: 'string' },
                            version: { type: 'integer' },
                        },
                        required: ['type', 'data'],
                        tsType: 'SerializedExcalidrawNode',
                    }
                },
                node: ExcalidrawServerNode,
            }),
        ],
    },
    key: 'excalidraw',
})
