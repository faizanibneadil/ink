'use client'

import React, { useMemo } from 'react'

import { useDocumentTheme } from '@/views/useDocumentTheme'

import { parseScene } from '../shared/scene'
import { ExcalidrawPreview } from '../shared/ExcalidrawPreview'

import '../shared/excalidraw.css'

/**
 * Read-only note view of a drawing: view only, rendered as an SVG once it scrolls into view.
 */
export const ExcalidrawViewer: React.FC<{ data: string }> = ({ data }) => {
    const theme = useDocumentTheme()
    const scene = useMemo(() => parseScene(data), [data])

    if (scene.elements.length === 0) {
        return null
    }

    return (
        <figure className="ink-excalidraw ink-excalidraw--readonly">
            <ExcalidrawPreview scene={scene} theme={theme} />
        </figure>
    )
}
