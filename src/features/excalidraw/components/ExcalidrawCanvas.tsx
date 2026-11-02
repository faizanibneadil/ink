'use client'

// Only loaded in the browser, through next/dynamic({ ssr: false }) in ExcalidrawModal.
import './excalidraw-assets'
import '@excalidraw/excalidraw/index.css'

import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState, ExcalidrawImperativeAPI, UIOptions } from '@excalidraw/excalidraw/types'

import { Excalidraw } from '@excalidraw/excalidraw'
import React, { useCallback, useEffect, useRef } from 'react'

import type { ExcalidrawScene } from '../scene'

export type ExcalidrawCanvasProps = {
    initialScene: ExcalidrawScene
    onApiReady?: (api: ExcalidrawImperativeAPI) => void
    onSceneChange?: (elements: readonly ExcalidrawElement[]) => void
    theme: 'dark' | 'light'
}

const uiOptions: Partial<UIOptions> = {
    canvasActions: {
        // No file system / scene loading: the drawing is only saved in the note
        export: false,
        loadScene: false,
        saveToActiveFile: false,
        toggleTheme: false,
    },
    // Images are disabled (they would be saved as base64 inside the note)
    tools: { image: false },
}

const hasImageFile = (dataTransfer: DataTransfer | null) =>
    Array.from(dataTransfer?.items ?? []).some((item) => item.kind === 'file' && item.type.startsWith('image/'))

const ExcalidrawCanvas: React.FC<ExcalidrawCanvasProps> = ({
    initialScene,
    onApiReady,
    onSceneChange,
    theme,
}) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
    const didFitRef = useRef(false)

    // Block image files dropped on the canvas (pasted images are blocked in `onPaste`)
    useEffect(() => {
        const container = containerRef.current
        if (!container) {
            return
        }
        const onDrop = (event: DragEvent) => {
            if (hasImageFile(event.dataTransfer)) {
                event.preventDefault()
                event.stopPropagation()
            }
        }
        container.addEventListener('drop', onDrop, true)
        return () => container.removeEventListener('drop', onDrop, true)
    }, [])

    const onPaste = useCallback((data: { elements?: readonly ExcalidrawElement[] }, event: ClipboardEvent | null) => {
        if (hasImageFile(event?.clipboardData ?? null)) {
            return false
        }
        if (data.elements?.some((el) => el.type === 'image')) {
            return false
        }
        return true
    }, [])

    const handleApi = useCallback(
        (api: ExcalidrawImperativeAPI) => {
            apiRef.current = api
            onApiReady?.(api)
        },
        [onApiReady],
    )

    const onChange = useCallback(
        (elements: readonly ExcalidrawElement[], _appState: AppState) => {
            // Once the saved drawing is loaded: show all of it (zoom out on small screens, never zoom in)
            if (!didFitRef.current && apiRef.current) {
                didFitRef.current = true
                if (elements.some((el) => !el.isDeleted)) {
                    apiRef.current.scrollToContent(undefined, { fitToViewport: true, maxZoom: 1, viewportZoomFactor: 0.9 })
                }
            }
            onSceneChange?.(elements)
        },
        [onSceneChange],
    )

    return (
        <div className="ink-excalidraw-canvas" ref={containerRef}>
            <Excalidraw
                autoFocus
                excalidrawAPI={handleApi}
                initialData={{
                    appState: initialScene.appState,
                    elements: initialScene.elements,
                    files: initialScene.files,
                }}
                onChange={onChange}
                onPaste={onPaste}
                theme={theme}
                UIOptions={uiOptions}
            />
        </div>
    )
}

export default ExcalidrawCanvas
