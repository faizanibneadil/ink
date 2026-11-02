'use client'

import {
    createClientFeature,
    slashMenuBasicGroupWithItems,
    toolbarAddDropdownGroupWithItems,
} from '@payloadcms/richtext-lexical/client'
import { $isNodeSelection } from '@payloadcms/richtext-lexical/lexical'

import { INSERT_CODE_BLOCK_COMMAND } from '../server/CodeBlockServerNode'
import { CodeBlockIcon } from '../shared/icons'
import { $isCodeBlockNode, CodeBlockNode } from './CodeBlockNode'
import { CODE_BLOCK_MARKDOWN_TRANSFORMER } from './markdownTransformer'
import { CodeBlockPlugin } from './plugin'

export const CodeBlockFeatureClient = createClientFeature({
    markdownTransformers: [CODE_BLOCK_MARKDOWN_TRANSFORMER],
    nodes: [CodeBlockNode],
    plugins: [
        {
            Component: CodeBlockPlugin,
            position: 'normal',
        },
    ],
    slashMenu: {
        groups: [
            slashMenuBasicGroupWithItems([
                {
                    Icon: CodeBlockIcon,
                    key: 'codeBlock',
                    keywords: ['code', 'codeblock', 'code block', 'snippet', 'monaco', 'pre', 'programming'],
                    label: ({ i18n }) => i18n.t('lexical:codeBlock:label'),
                    onSelect: ({ editor }) => {
                        editor.dispatchCommand(INSERT_CODE_BLOCK_COMMAND, undefined)
                    },
                },
            ]),
        ],
    },
    toolbarFixed: {
        groups: [
            toolbarAddDropdownGroupWithItems([
                {
                    ChildComponent: CodeBlockIcon,
                    isActive: ({ selection }) => {
                        if (!$isNodeSelection(selection) || !selection.getNodes().length) {
                            return false
                        }
                        return $isCodeBlockNode(selection.getNodes()[0])
                    },
                    key: 'codeBlock',
                    label: ({ i18n }) => i18n.t('lexical:codeBlock:label'),
                    onSelect: ({ editor }) => {
                        editor.dispatchCommand(INSERT_CODE_BLOCK_COMMAND, undefined)
                    },
                },
            ]),
        ],
    },
})
