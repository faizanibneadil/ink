'use client'

import { useTheme } from '@payloadcms/ui'
import React, { useMemo } from 'react'

import { parseScene } from '../scene'
import { ExcalidrawPreview } from './ExcalidrawPreview'

import '../excalidraw.css'

/**
 * Read-only note view of a drawing: view only, rendered as an SVG once it scrolls into view.
 */
export const ExcalidrawViewer: React.FC<{ data: string }> = ({ data }) => {
    const { theme } = useTheme()
    const scene = useMemo(() => parseScene(data), [data])

    if (scene.elements.length === 0) {
        return null
    }

    return (
        <figure className="ink-excalidraw ink-excalidraw--readonly">
            <ExcalidrawPreview scene={scene} theme={theme === 'dark' ? 'dark' : 'light'} />
        </figure>
    )
}
