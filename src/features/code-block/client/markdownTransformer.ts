import type { MultilineElementTransformer } from '@payloadcms/richtext-lexical/lexical/markdown'

import { $createParagraphNode } from '@payloadcms/richtext-lexical/lexical'

import { $isCodeBlockServerNode, CodeBlockServerNode } from '../server/CodeBlockServerNode'
import { DEFAULT_CODE_LANGUAGE, findCodeLanguage } from '../shared/languages'
import { $createCodeBlockNode } from './CodeBlockNode'
import { markFocusOnMount } from './focusOnMount'

/**
 * ``` markdown shortcut (like the Lexical playground): on a new line type ``` (optionally with a
 * language, e.g. ```ts or ```python) and press Space or Enter, the line becomes a code block.
 * An unknown language falls back to the default language.
 *
 * It is a multiline transformer, so it also runs on Enter (Lexical runs multiline transformers on
 * Enter before element transformers).
 *
 * Markdown import (```lang ... ```) and export also go through this transformer.
 */
export const CODE_BLOCK_MARKDOWN_TRANSFORMER: MultilineElementTransformer = {
    type: 'multiline-element',
    dependencies: [CodeBlockServerNode],
    export: (node) => {
        if (!$isCodeBlockServerNode(node)) {
            return null
        }
        return '```' + node.getLanguage() + '\n' + node.getCode() + '\n```'
    },
    regExpEnd: {
        optional: true,
        regExp: /[ \t]*```$/,
    },
    regExpStart: /^[ \t]*```([^\s`]*)\s?/,
    replace: (rootNode, _children, startMatch, _endMatch, linesInBetween, isImport) => {
        const language = findCodeLanguage(startMatch[1] ?? '') ?? DEFAULT_CODE_LANGUAGE

        if (isImport) {
            const lines = [...(linesInBetween ?? [])]
            if (lines[0] === '') {
                lines.shift()
            }
            if (lines[lines.length - 1] === '') {
                lines.pop()
            }
            rootNode.append($createCodeBlockNode({ code: lines.join('\n'), language }))
            return
        }

        // Typed in the editor: the ``` line becomes an empty code block with the cursor in it
        const node = $createCodeBlockNode({ language })
        markFocusOnMount(node.getKey())
        rootNode.replace(node)
        // Keep a line below the code block, so the user can continue writing after it
        if (!node.getNextSibling()) {
            node.insertAfter($createParagraphNode())
        }
    },
}
