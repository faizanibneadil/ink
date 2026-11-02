'use client'

import type { PluginComponent } from '@payloadcms/richtext-lexical'

import {
    $getSelection,
    $isNodeSelection,
    $isParagraphNode,
    $isRangeSelection,
    COMMAND_PRIORITY_EDITOR,
} from '@payloadcms/richtext-lexical/lexical'
import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext'
import { $insertNodeToNearestRoot } from '@payloadcms/richtext-lexical/lexical/utils'
import { useEffect } from 'react'

import { INSERT_CODE_BLOCK_COMMAND } from '../server/CodeBlockServerNode'
import { $createCodeBlockNode, CodeBlockNode } from './CodeBlockNode'
import { markFocusOnMount } from './focusOnMount'

/** Registers INSERT_CODE_BLOCK_COMMAND: inserts an empty code block and puts the cursor in its editor. */
export const CodeBlockPlugin: PluginComponent = () => {
    const [editor] = useLexicalComposerContext()

    useEffect(() => {
        if (!editor.hasNodes([CodeBlockNode])) {
            throw new Error('CodeBlockPlugin: CodeBlockNode is not registered on the editor')
        }

        return editor.registerCommand(
            INSERT_CODE_BLOCK_COMMAND,
            (payload) => {
                const selection = $getSelection()
                if (!$isRangeSelection(selection) && !$isNodeSelection(selection)) {
                    return false
                }
                const node = $createCodeBlockNode(payload)
                markFocusOnMount(node.getKey())
                const focusNode = $isRangeSelection(selection) ? selection.focus.getNode() : null
                $insertNodeToNearestRoot(node)
                // Like Payload's blocks: the empty line the code block was inserted from is removed
                if ($isParagraphNode(focusNode) && focusNode.isAttached() && focusNode.isEmpty()) {
                    focusNode.remove()
                }
                return true
            },
            COMMAND_PRIORITY_EDITOR,
        )
    }, [editor])

    return null
}
