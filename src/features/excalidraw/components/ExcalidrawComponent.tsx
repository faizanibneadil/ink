'use client'

import type { NodeKey } from '@payloadcms/richtext-lexical/lexical'

import {
    $getNodeByKey,
    $getSelection,
    $isNodeSelection,
    CLICK_COMMAND,
    COMMAND_PRIORITY_LOW,
    KEY_BACKSPACE_COMMAND,
    KEY_DELETE_COMMAND,
    mergeRegister,
} from '@payloadcms/richtext-lexical/lexical'
import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@payloadcms/richtext-lexical/lexical/react/useLexicalEditable'
import { useLexicalNodeSelection } from '@payloadcms/richtext-lexical/lexical/react/useLexicalNodeSelection'
import { useTheme } from '@payloadcms/ui'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { clearOpenOnMount, shouldOpenOnMount } from '../openOnMount'
import { $isExcalidrawNode } from '../nodes/ExcalidrawNode'
import { parseScene } from '../scene'
import { ExcalidrawModal } from './ExcalidrawModal'
import { ExcalidrawPreview } from './ExcalidrawPreview'

import '../excalidraw.css'

type Props = {
    data: string
    nodeKey: NodeKey
}

/** Editor view of a drawing: preview + Edit / Delete buttons + the full screen drawing modal. */
export const ExcalidrawComponent: React.FC<Props> = ({ data, nodeKey }) => {
    const [editor] = useLexicalComposerContext()
    const isEditable = useLexicalEditable()
    const { theme } = useTheme()
    const scene = useMemo(() => parseScene(data), [data])
    const hasDrawing = scene.elements.length > 0
    const containerRef = useRef<HTMLDivElement>(null)
    const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey)
    // Drawings just inserted from the toolbar / slash menu open the modal right away
    const [isModalOpen, setIsModalOpen] = useState(() => shouldOpenOnMount(nodeKey))

    useEffect(() => {
        clearOpenOnMount(nodeKey)
    }, [nodeKey])

    const removeNode = useCallback(() => {
        editor.update(() => {
            $getNodeByKey(nodeKey)?.remove()
        })
    }, [editor, nodeKey])

    const openModal = useCallback(() => setIsModalOpen(true), [])

    const onSave = useCallback(
        (nextData: null | string) => {
            setIsModalOpen(false)
            if (nextData === null) {
                // Nothing drawn: no empty drawing in the note
                removeNode()
                return
            }
            editor.update(() => {
                const node = $getNodeByKey(nodeKey)
                if ($isExcalidrawNode(node)) {
                    node.setData(nextData)
                }
            })
        },
        [editor, nodeKey, removeNode],
    )

    const onCancel = useCallback(() => {
        setIsModalOpen(false)
        // A new drawing that was never saved is removed
        if (!hasDrawing) {
            removeNode()
        }
    }, [hasDrawing, removeNode])

    const onDelete = useCallback(() => {
        setIsModalOpen(false)
        removeNode()
    }, [removeNode])

    // Click selects the drawing, double click opens it, Delete / Backspace removes a selected drawing
    useEffect(() => {
        if (!isEditable) {
            if (isSelected) {
                clearSelection()
            }
            return
        }

        const $onDelete = (event: KeyboardEvent) => {
            const selection = $getSelection()
            if (isSelected && $isNodeSelection(selection) && selection.has(nodeKey)) {
                event.preventDefault()
                $getNodeByKey(nodeKey)?.remove()
                return true
            }
            return false
        }

        return mergeRegister(
            editor.registerCommand<MouseEvent>(
                CLICK_COMMAND,
                (event) => {
                    const target = event.target
                    const container = containerRef.current
                    if (!container || !(target instanceof Node) || !container.contains(target)) {
                        return false
                    }
                    if (target instanceof Element && target.closest('button')) {
                        // Edit / Delete buttons handle their own click
                        return true
                    }
                    if (event.detail > 1) {
                        setIsModalOpen(true)
                        return true
                    }
                    if (!event.shiftKey) {
                        clearSelection()
                    }
                    setSelected(!isSelected)
                    return true
                },
                COMMAND_PRIORITY_LOW,
            ),
            editor.registerCommand(KEY_DELETE_COMMAND, $onDelete, COMMAND_PRIORITY_LOW),
            editor.registerCommand(KEY_BACKSPACE_COMMAND, $onDelete, COMMAND_PRIORITY_LOW),
        )
    }, [clearSelection, editor, isEditable, isSelected, nodeKey, setSelected])

    const resolvedTheme = theme === 'dark' ? 'dark' : 'light'

    return (
        <div
            className={[
                'ink-excalidraw',
                isSelected && isEditable ? 'ink-excalidraw--selected' : '',
                !hasDrawing ? 'ink-excalidraw--empty' : '',
            ].filter(Boolean).join(' ')}
            ref={containerRef}
        >
            {hasDrawing ? (
                <ExcalidrawPreview scene={scene} theme={resolvedTheme} />
            ) : (
                <div className="ink-excalidraw__empty">Empty drawing</div>
            )}
            {isEditable ? (
                <div className="ink-excalidraw__toolbar">
                    <button
                        aria-label="Edit drawing"
                        className="ink-excalidraw-btn ink-excalidraw-btn--small"
                        onClick={openModal}
                        onMouseDown={(event) => event.preventDefault()}
                        type="button"
                    >
                        Edit
                    </button>
                    <button
                        aria-label="Delete drawing"
                        className="ink-excalidraw-btn ink-excalidraw-btn--small ink-excalidraw-btn--danger"
                        onClick={removeNode}
                        onMouseDown={(event) => event.preventDefault()}
                        type="button"
                    >
                        Delete
                    </button>
                </div>
            ) : null}
            {isEditable && isModalOpen ? (
                <ExcalidrawModal
                    initialScene={scene}
                    mode="edit"
                    onCancel={onCancel}
                    onDelete={onDelete}
                    onSave={onSave}
                    theme={resolvedTheme}
                />
            ) : null}
        </div>
    )
}
