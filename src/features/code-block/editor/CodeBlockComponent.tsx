'use client'

import type { NodeKey } from '@payloadcms/richtext-lexical/lexical'
import type { ComboboxEntry } from '@payloadcms/ui'

import { $getNodeByKey } from '@payloadcms/richtext-lexical/lexical'
import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@payloadcms/richtext-lexical/lexical/react/useLexicalEditable'
import {
    Button,
    ChevronIcon,
    CodeEditor,
    Collapsible,
    Combobox,
    CopyToClipboard,
    PopupList,
    useTranslation,
} from '@payloadcms/ui'
import React, { useCallback, useId, useMemo } from 'react'

import { $isCodeBlockNode } from '../client/CodeBlockNode'
import { takeFocusOnMount } from '../client/focusOnMount'
import { type CodeLanguage, codeLanguages, toMonacoLanguage } from '../shared/languages'
import { CodeBlockIcon } from '../shared/icons'

import './code-block-editor.css'

const baseClass = 'ink-code-block'

type Props = {
    code: string
    filename: string
    language: CodeLanguage
    nodeKey: NodeKey
}

type Monaco = Parameters<NonNullable<React.ComponentProps<typeof CodeEditor>['onMount']>>[1]

/** Same TypeScript / JSX settings Payload's code block gives Monaco (no type errors, JSX allowed) */
const configureMonaco = (monaco: Monaco) => {
    const typescript = monaco.languages.typescript
    const compilerOptions = {
        allowJs: true,
        allowNonTsExtensions: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        jsx: typescript.JsxEmit.React,
        moduleResolution: typescript.ModuleResolutionKind.NodeJs,
        noEmit: true,
        reactNamespace: 'React',
        target: typescript.ScriptTarget.ESNext,
    }
    const diagnosticsOptions = { noSemanticValidation: true, noSyntaxValidation: false }
    typescript.typescriptDefaults.setCompilerOptions(compilerOptions)
    typescript.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions)
    typescript.javascriptDefaults.setCompilerOptions(compilerOptions)
    typescript.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions)
}

/**
 * Editor view of the native code block. Looks like Payload's own code block (header with file name,
 * language dropdown, copy and remove; Monaco editor below) but the code, language and file name are
 * written straight into the Lexical node: no block form state, no server request.
 */
export const CodeBlockComponent: React.FC<Props> = ({ code, filename, language, nodeKey }) => {
    const [editor] = useLexicalComposerContext()
    const isEditable = useLexicalEditable()
    const { t } = useTranslation()
    const instanceId = useId()

    const monacoLanguage = toMonacoLanguage(language)
    // A file name lets Monaco treat TS / JS as TSX / JSX, so JSX is not marked as an error
    const modelPath = useMemo(() => {
        const id = `${nodeKey}-${instanceId.replace(/[^\w-]/g, '')}`
        if (monacoLanguage === 'typescript') {
            return `ink-code-block-${id}.tsx`
        }
        if (monacoLanguage === 'javascript') {
            return `ink-code-block-${id}.jsx`
        }
        return undefined
    }, [instanceId, monacoLanguage, nodeKey])

    const setCode = useCallback(
        (nextCode: string | undefined) => {
            editor.update(() => {
                const node = $getNodeByKey(nodeKey)
                if ($isCodeBlockNode(node) && node.getCode() !== (nextCode ?? '')) {
                    node.setCode(nextCode ?? '')
                }
            })
        },
        [editor, nodeKey],
    )

    const setFilename = useCallback(
        (nextFilename: string) => {
            editor.update(() => {
                const node = $getNodeByKey(nodeKey)
                if ($isCodeBlockNode(node)) {
                    node.setFilename(nextFilename)
                }
            })
        },
        [editor, nodeKey],
    )

    const setLanguage = useCallback(
        (nextLanguage: CodeLanguage) => {
            editor.update(() => {
                const node = $getNodeByKey(nodeKey)
                if ($isCodeBlockNode(node)) {
                    node.setLanguage(nextLanguage)
                }
            })
        },
        [editor, nodeKey],
    )

    const removeNode = useCallback(() => {
        editor.update(() => {
            $getNodeByKey(nodeKey)?.remove()
        })
    }, [editor, nodeKey])

    const languageEntries = useMemo<ComboboxEntry[]>(
        () =>
            Object.entries(codeLanguages).map(([languageCode, languageLabel]) => ({
                name: `${languageCode} ${languageLabel}`,
                Component: (
                    <PopupList.Button active={languageCode === language} onClick={() => setLanguage(languageCode as CodeLanguage)}>
                        <span className={`${baseClass}__language-code`} data-language={languageCode}>
                            {languageLabel}
                        </span>
                    </PopupList.Button>
                ),
            })),
        [language, setLanguage],
    )

    return (
        <div
            className={`${baseClass}__container`}
            // Keys typed in the header (file name, language search, buttons) belong to it, not to the
            // rich text editor
            onKeyDownCapture={(event) => {
                const target = event.target as HTMLElement
                if (target.closest(`.${baseClass}__header, .${baseClass}__actions, .combobox`)) {
                    event.stopPropagation()
                }
            }}
        >
            <Collapsible
                actions={
                    <div className={`${baseClass}__actions`}>
                        <Combobox
                            aria-label={t('general:language')}
                            button={
                                <div className={`${baseClass}__language-selector-button`} data-selected-language={language}>
                                    <span>{codeLanguages[language]}</span>
                                    <ChevronIcon className={`${baseClass}__chevron`} />
                                </div>
                            }
                            buttonType="custom"
                            className={`${baseClass}__language-selector`}
                            disabled={!isEditable}
                            entries={languageEntries}
                            horizontalAlign="right"
                            minEntriesForSearch={8}
                            searchPlaceholder={t('fields:searchForLanguage')}
                            showScrollbar
                            size="large"
                        />
                        <CopyToClipboard value={code} />
                        {isEditable ? (
                            <Button
                                buttonStyle="ghost"
                                className={`${baseClass}__remove-button`}
                                icon="x"
                                onClick={(event) => {
                                    event.preventDefault()
                                    removeNode()
                                }}
                                round
                                tooltip="Remove Code Block"
                            />
                        ) : null}
                    </div>
                }
                className={baseClass}
                disableHeaderToggle
                disableToggleIndicator
                header={
                    <div className={`${baseClass}__header`}>
                        <div className={`${baseClass}__pill`}>
                            <CodeBlockIcon />
                        </div>
                        {/* Same look as the block name input of Payload's blocks (`section-title`) */}
                        <div className={`section-title ${baseClass}__filename`}>
                            <input
                                aria-label="File name"
                                className="section-title__input"
                                onChange={(event) => setFilename(event.target.value)}
                                placeholder="Untitled"
                                readOnly={!isEditable}
                                spellCheck={false}
                                type="text"
                                value={filename}
                            />
                        </div>
                    </div>
                }
                // Always open: no collapse / expand
                isCollapsed={false}
            >
                <CodeEditor
                    language={monacoLanguage}
                    onChange={setCode}
                    onMount={(monacoEditor, monaco) => {
                        configureMonaco(monaco)
                        if (takeFocusOnMount(nodeKey)) {
                            monacoEditor.focus()
                        }
                    }}
                    options={{ lineNumbers: 'on' }}
                    path={modelPath}
                    readOnly={!isEditable}
                    value={code}
                />
            </Collapsible>
        </div>
    )
}
