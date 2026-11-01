'use client'

import type { PluginComponent } from '@payloadcms/richtext-lexical'

import {
    $getSelection,
    $isNodeSelection,
    $isRangeSelection,
    COMMAND_PRIORITY_EDITOR,
} from '@payloadcms/richtext-lexical/lexical'
import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext'
import { $insertNodeToNearestRoot } from '@payloadcms/richtext-lexical/lexical/utils'
import { useEffect } from 'react'

import { markOpenOnMount } from './openOnMount'
import { $createExcalidrawNode, ExcalidrawNode } from './nodes/ExcalidrawNode'
import { INSERT_EXCALIDRAW_COMMAND } from './nodes/ExcalidrawServerNode'

/** Registers INSERT_EXCALIDRAW_COMMAND: inserts an empty drawing and opens the drawing modal. */
export const ExcalidrawPlugin: PluginComponent = () => {
    const [editor] = useLexicalComposerContext()

    useEffect(() => {
        if (!editor.hasNodes([ExcalidrawNode])) {
            throw new Error('ExcalidrawPlugin: ExcalidrawNode is not registered on the editor')
        }

        return editor.registerCommand(
            INSERT_EXCALIDRAW_COMMAND,
            () => {
                const selection = $getSelection()
                if (!$isRangeSelection(selection) && !$isNodeSelection(selection)) {
                    return false
                }
                const node = $createExcalidrawNode()
                markOpenOnMount(node.getKey())
                $insertNodeToNearestRoot(node)
                return true
            },
            COMMAND_PRIORITY_EDITOR,
        )
    }, [editor])

    return null
}
