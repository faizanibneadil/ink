'use client'
import type {
    DefaultNodeTypes,
    LexicalEditorViewMap,
    SerializedBlockNode,
} from '@payloadcms/richtext-lexical'
import type { CodeBlock, WhiteboardBlockPropsType } from '@/payload-types'

type NodeTypes =
    | DefaultNodeTypes
    | SerializedBlockNode<WhiteboardBlockPropsType | CodeBlock>

export const views: LexicalEditorViewMap<NodeTypes> = {
    default: {
        admin: {
            hideGutter: true,               // Notion mein left border/gutter nahi hota
            hideInsertParagraphAtEnd: true,
            placeholder: "Write, or press '/' for commands…",
            // drag handle + add-block button rehne do — Notion ka ⋮⋮ aur + yahi hain
        },
        filterFeatures: (features) => {
            const { toolbarFixed, ...rest } = features   // inline toolbar + slash menu rehne do
            return rest
        },
        lexical: (config) => ({
            ...config,
            theme: {
                ...config.theme,
                root: `${config.theme?.root ?? ''} note_root`,   // default class bhi rakho
            },
        }),
        nodes: {
            blocks: {
                CodeBlock: {   // ← apna asal slug likho
                    Block: (props) => {
                        const { code, language } = props.formData

                        if (props.isEditor) {
                            const { EditButton, RemoveButton } = props.useBlockComponentContext()
                            return (
                                <div className="n-code">
                                    <div className="n-code__bar">
                                        <span>{language ?? 'plain text'}</span>
                                        <span className="n-code__actions"><EditButton /><RemoveButton /></span>
                                    </div>
                                    <pre><code>{code}</code></pre>
                                </div>
                            )
                        }
                        // frontend (JSX converter)
                        return (
                            <div className="n-code">
                                <div className="n-code__bar"><span>{language}</span></div>
                                <pre><code>{code}</code></pre>
                            </div>
                        )
                    },
                },
                whiteboard: {
                    Block: (props) => (
                        <div className="n-callout">🧩 {props.formData.blockType}</div>
                    ),
                },
            },
        },
    },

    // Optional: purana Payload look comparison ke liye
    classic: { nodes: {} },
}