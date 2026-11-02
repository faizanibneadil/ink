'use client'

import {
    createClientFeature,
    slashMenuBasicGroupWithItems,
    toolbarAddDropdownGroupWithItems,
} from '@payloadcms/richtext-lexical/client'
import { $isNodeSelection } from '@payloadcms/richtext-lexical/lexical'

import { DrawingIcon } from './icon'
import { $isExcalidrawNode, ExcalidrawNode } from './nodes/ExcalidrawNode'
import { INSERT_EXCALIDRAW_COMMAND } from './nodes/ExcalidrawServerNode'
import { ExcalidrawPlugin } from './plugin'

export const ExcalidrawFeatureClient = createClientFeature({
    nodes: [ExcalidrawNode],
    plugins: [
        {
            Component: ExcalidrawPlugin,
            position: 'normal',
        },
    ],
    slashMenu: {
        groups: [
            slashMenuBasicGroupWithItems([
                {
                    Icon: DrawingIcon,
                    key: 'excalidraw',
                    keywords: ['excalidraw', 'drawing', 'draw', 'sketch', 'whiteboard', 'diagram'],
                    label: ({ i18n }) => i18n.t('lexical:excalidraw:label'),
                    onSelect: ({ editor }) => {
                        editor.dispatchCommand(INSERT_EXCALIDRAW_COMMAND, undefined)
                    },
                },
            ]),
        ],
    },
    toolbarFixed: {
        groups: [
            toolbarAddDropdownGroupWithItems([
                {
                    ChildComponent: DrawingIcon,
                    isActive: ({ selection }) => {
                        if (!$isNodeSelection(selection) || !selection.getNodes().length) {
                            return false
                        }
                        return $isExcalidrawNode(selection.getNodes()[0])
                    },
                    key: 'excalidraw',
                    label: ({ i18n }) => i18n.t('lexical:excalidraw:label'),
                    onSelect: ({ editor }) => {
                        editor.dispatchCommand(INSERT_EXCALIDRAW_COMMAND, undefined)
                    },
                },
            ]),
        ],
    },
})
