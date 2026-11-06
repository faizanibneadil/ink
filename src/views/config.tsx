'use client'
import type {
    DefaultNodeTypes,
    LexicalEditorViewMap,
} from '@payloadcms/richtext-lexical'
import type { SerializedCodeBlockNode } from '@/features/code-block'
import type { SerializedExcalidrawNode } from '@/features/excalidraw'

import { addNoteViewClasses } from './notion-theme'

type NodeTypes =
    | DefaultNodeTypes
    | SerializedCodeBlockNode
    | SerializedExcalidrawNode

/** Name of the view the note page (`/<slug>`) uses. The Payload admin always uses `default`. */
export const NOTION_VIEW = 'notion'

/**
 * Lexical views of `notes.note` (https://payloadcms.com/docs/beta/rich-text/views):
 *
 * - `default`: the Payload admin editor, unchanged (fixed toolbar, Monaco code block).
 * - `notion`:  the editor on the note page (src/views/editor.tsx forces it with `RichTextViewProvider`).
 *              Notion-like: no fixed toolbar (slash menu, inline toolbar and drag handle stay), the read-only
 *              view's typography, Notion's placeholder.
 *
 * The admin would show a "Default / Notion" view selector above the field; it is hidden there (src/app/custom.css).
 */
export const views: LexicalEditorViewMap<NodeTypes> = {
    default: {
        nodes: {}
    },
    [NOTION_VIEW]: {
        admin: {
            placeholder: "Type '/' for commands",
        },
        filterFeatures: (features) => {
            const { toolbarFixed: _toolbarFixed, ...rest } = features
            return rest
        },
        lexical: (defaultConfig) => ({
            ...defaultConfig,
            theme: addNoteViewClasses(defaultConfig.theme),
        }),
        nodes: {},
    },
}
