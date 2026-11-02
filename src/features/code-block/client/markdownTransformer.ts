import type { ElementTransformer } from '@payloadcms/richtext-lexical/lexical/markdown'

import { $createParagraphNode } from '@payloadcms/richtext-lexical/lexical'

import { $isCodeBlockServerNode, CodeBlockServerNode } from '../server/CodeBlockServerNode'
import { DEFAULT_CODE_LANGUAGE, findCodeLanguage } from '../shared/languages'
import { $createCodeBlockNode } from './CodeBlockNode'
import { markFocusOnMount } from './focusOnMount'

/**
 * ``` markdown shortcut (like the Lexical playground): on a new line type ``` (optionally with a
 * language, e.g. ```ts or ```python) and press Space or Enter, the line becomes a code block.
 * An unknown language falls back to the default language.
 * Markdown export: ```<language>\n<code>\n```
 */
export const CODE_BLOCK_MARKDOWN_TRANSFORMER: ElementTransformer = {
    type: 'element',
    dependencies: [CodeBlockServerNode],
    export: (node) => {
        if (!$isCodeBlockServerNode(node)) {
            return null
        }
        return '```' + node.getLanguage() + '\n' + node.getCode() + '\n```'
    },
    regExp: /^```([^\s`]*)\s?$/,
    replace: (parentNode, _children, match) => {
        const language = findCodeLanguage(match[1] ?? '') ?? DEFAULT_CODE_LANGUAGE
        const node = $createCodeBlockNode({ language })
        markFocusOnMount(node.getKey())
        parentNode.replace(node)
        // Keep a line below the code block, so the user can continue writing after it
        if (!node.getNextSibling()) {
            node.insertAfter($createParagraphNode())
        }
    },
    triggerOnEnter: true,
}
