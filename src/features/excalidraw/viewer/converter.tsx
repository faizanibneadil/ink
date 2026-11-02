'use client'

import type { JSXConverters } from '@payloadcms/richtext-lexical/react'

import type { SerializedExcalidrawNode } from '../server/ExcalidrawServerNode'
import { ExcalidrawViewer } from './ExcalidrawViewer'

export type ExcalidrawViewerNodeTypes = SerializedExcalidrawNode

/** Read-only note view converter: the drawing is rendered (view only) once it scrolls into view. */
export const excalidrawConverters: JSXConverters<ExcalidrawViewerNodeTypes> = {
    excalidraw: ({ node }) => <ExcalidrawViewer data={node.data} />,
}
