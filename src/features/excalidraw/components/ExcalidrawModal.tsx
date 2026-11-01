'use client'

import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

import dynamic from 'next/dynamic'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { type ExcalidrawScene, getSceneVersion, serializeScene } from '../scene'

const ExcalidrawCanvas = dynamic(() => import('./ExcalidrawCanvas'), {
    loading: () => (
        <div className="ink-excalidraw-modal__loading" role="status">
            Loading drawing…
        </div>
    ),
    ssr: false,
})

type BaseProps = {
    initialScene: ExcalidrawScene
    theme: 'dark' | 'light'
}

type EditProps = {
    mode: 'edit'
    /** Close without saving */
    onCancel: () => void
    /** Remove the drawing from the note */
    onDelete: () => void
    /** `null` = the drawing is empty */
    onSave: (data: null | string) => void
} & BaseProps

type ViewProps = {
    mode: 'view'
    onClose: () => void
} & BaseProps

export type ExcalidrawModalProps = EditProps | ViewProps

/** True when Escape should be left to Excalidraw (finish a text or a line, close a menu / popup...) */
const excalidrawUsesEscape = (api: ExcalidrawImperativeAPI | null) => {
    const active = document.activeElement
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        return true
    }
    if (!api) {
        return false
    }
    const state = api.getAppState()
    return Boolean(
        state.editingTextElement
        || state.newElement
        || state.multiElement
        || state.editingLinearElement
        || state.selectedLinearElement
        || state.contextMenu
        || state.openMenu
        || state.openPopup
        || state.openDialog
        || state.openSidebar
        || state.showHyperlinkPopup,
    )
}

/**
 * Full screen (100% width × 100% height) Excalidraw modal.
 * - `edit`: Cancel / Delete / Save. Cancel and Escape ask before discarding unsaved changes.
 * - `view`: read-only (view mode: pan and zoom only), Close.
 */
export const ExcalidrawModal: React.FC<ExcalidrawModalProps> = (props) => {
    const { initialScene, mode, theme } = props
    const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
    const baselineVersionRef = useRef<null | number>(null)
    const latestVersionRef = useRef<null | number>(null)
    const dialogRef = useRef<HTMLDivElement>(null)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)

    // Keep the latest props for the keyboard listener
    const propsRef = useRef(props)
    useEffect(() => {
        propsRef.current = props
    })

    const onApiReady = useCallback((api: ExcalidrawImperativeAPI) => {
        apiRef.current = api
    }, [])

    const onSceneChange = useCallback((elements: readonly ExcalidrawElement[]) => {
        const version = getSceneVersion(elements)
        if (baselineVersionRef.current === null) {
            baselineVersionRef.current = version
        }
        latestVersionRef.current = version
    }, [])

    const isDirty = () =>
        baselineVersionRef.current !== null && latestVersionRef.current !== baselineVersionRef.current

    const requestClose = useCallback(() => {
        const current = propsRef.current
        if (current.mode === 'view') {
            current.onClose()
            return
        }
        if (isDirty()) {
            setIsConfirmOpen(true)
        } else {
            current.onCancel()
        }
    }, [])

    const save = () => {
        if (props.mode !== 'edit') {
            return
        }
        const api = apiRef.current
        if (!api) {
            // Excalidraw not loaded yet: nothing was drawn
            props.onCancel()
            return
        }
        props.onSave(serializeScene(api.getSceneElementsIncludingDeleted(), api.getAppState()))
    }

    // Lock page scroll while the modal is open
    useEffect(() => {
        const { body } = document
        const previous = body.style.overflow
        body.style.overflow = 'hidden'
        return () => {
            body.style.overflow = previous
        }
    }, [])

    // Escape: capture phase, so Excalidraw's own state is checked before it handles the key
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented) {
                return
            }
            if (isConfirmOpen) {
                event.preventDefault()
                event.stopPropagation()
                setIsConfirmOpen(false)
                return
            }
            if (excalidrawUsesEscape(apiRef.current)) {
                return
            }
            event.preventDefault()
            event.stopPropagation()
            requestClose()
        }
        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
    }, [isConfirmOpen, requestClose])

    // Focus the confirm dialog's safe button
    useEffect(() => {
        if (isConfirmOpen) {
            dialogRef.current?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus()
        }
    }, [isConfirmOpen])

    // Events inside this portal must not reach the editor / Payload form (React bubbles through portals)
    const stop = (event: React.SyntheticEvent) => event.stopPropagation()

    return createPortal(
        <div
            aria-label={mode === 'edit' ? 'Edit drawing' : 'Drawing'}
            aria-modal="true"
            className={`ink-excalidraw-modal ink-excalidraw-modal--${mode}`}
            data-theme={theme}
            onClick={stop}
            onFocus={stop}
            onKeyDown={stop}
            onMouseDown={stop}
            onPointerDown={stop}
            role="dialog"
        >
            <div className="ink-excalidraw-modal__header">
                <span className="ink-excalidraw-modal__title">{mode === 'edit' ? 'Drawing' : 'Drawing (view only)'}</span>
                <div className="ink-excalidraw-modal__actions">
                    {props.mode === 'edit' ? (
                        <>
                            <button
                                className="ink-excalidraw-btn ink-excalidraw-btn--danger"
                                onClick={props.onDelete}
                                type="button"
                            >
                                Delete
                            </button>
                            <button className="ink-excalidraw-btn" onClick={requestClose} type="button">
                                Cancel
                            </button>
                            <button
                                className="ink-excalidraw-btn ink-excalidraw-btn--primary"
                                onClick={save}
                                type="button"
                            >
                                Save
                            </button>
                        </>
                    ) : (
                        <button className="ink-excalidraw-btn" onClick={props.onClose} type="button">
                            Close
                        </button>
                    )}
                </div>
            </div>
            <div className="ink-excalidraw-modal__body">
                <ExcalidrawCanvas
                    initialScene={initialScene}
                    onApiReady={onApiReady}
                    onSceneChange={onSceneChange}
                    theme={theme}
                    viewMode={mode === 'view'}
                />
            </div>
            {isConfirmOpen && props.mode === 'edit' ? (
                <div className="ink-excalidraw-confirm" role="presentation">
                    <div
                        aria-describedby="ink-excalidraw-confirm-text"
                        aria-labelledby="ink-excalidraw-confirm-title"
                        aria-modal="true"
                        className="ink-excalidraw-confirm__dialog"
                        ref={dialogRef}
                        role="alertdialog"
                    >
                        <h2 className="ink-excalidraw-confirm__title" id="ink-excalidraw-confirm-title">
                            Discard changes?
                        </h2>
                        <p className="ink-excalidraw-confirm__text" id="ink-excalidraw-confirm-text">
                            Your unsaved changes to this drawing will be lost.
                        </p>
                        <div className="ink-excalidraw-confirm__actions">
                            <button
                                className="ink-excalidraw-btn"
                                data-autofocus
                                onClick={() => setIsConfirmOpen(false)}
                                type="button"
                            >
                                Keep editing
                            </button>
                            <button
                                className="ink-excalidraw-btn ink-excalidraw-btn--danger"
                                onClick={() => {
                                    setIsConfirmOpen(false)
                                    props.onCancel()
                                }}
                                type="button"
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>,
        document.body,
    )
}
