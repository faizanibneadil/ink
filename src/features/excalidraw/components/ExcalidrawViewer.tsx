'use client'

import { useTheme } from '@payloadcms/ui'
import React, { useMemo, useState } from 'react'

import { parseScene } from '../scene'
import { ExcalidrawModal } from './ExcalidrawModal'
import { ExcalidrawPreview } from './ExcalidrawPreview'

import '../excalidraw.css'

const ExpandIcon = () => (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="16">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
)

/**
 * Read-only note view of a drawing: lazily rendered preview + an expand button that opens the
 * drawing full screen in Excalidraw's view mode (pan / zoom, no editing).
 */
export const ExcalidrawViewer: React.FC<{ data: string }> = ({ data }) => {
    const { theme } = useTheme()
    const scene = useMemo(() => parseScene(data), [data])
    const [isExpanded, setIsExpanded] = useState(false)
    const resolvedTheme = theme === 'dark' ? 'dark' : 'light'

    if (scene.elements.length === 0) {
        return null
    }

    return (
        <figure className="ink-excalidraw ink-excalidraw--readonly">
            <ExcalidrawPreview scene={scene} theme={resolvedTheme} />
            <button
                aria-label="Open drawing full screen"
                className="ink-excalidraw__expand"
                onClick={() => setIsExpanded(true)}
                title="Open full screen"
                type="button"
            >
                <ExpandIcon />
            </button>
            {isExpanded ? (
                <ExcalidrawModal
                    initialScene={scene}
                    mode="view"
                    onClose={() => setIsExpanded(false)}
                    theme={resolvedTheme}
                />
            ) : null}
        </figure>
    )
}
