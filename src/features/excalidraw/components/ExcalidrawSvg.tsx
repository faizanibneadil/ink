'use client'

// Only loaded in the browser, through next/dynamic({ ssr: false }) in ExcalidrawPreview,
// and only once the drawing scrolls into view.
import './excalidraw-assets'

import { exportToSvg } from '@excalidraw/excalidraw'
import React, { useEffect, useRef, useState } from 'react'

import { EXPORT_PADDING, type ExcalidrawScene } from '../scene'

export type ExcalidrawSvgProps = {
    onRendered?: () => void
    scene: ExcalidrawScene
    theme: 'dark' | 'light'
}

/** Renders the drawing as an SVG (read-only), like the Lexical playground's ExcalidrawImage. */
const ExcalidrawSvg: React.FC<ExcalidrawSvgProps> = ({ onRendered, scene, theme }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [failed, setFailed] = useState(false)
    const onRenderedRef = useRef(onRendered)
    useEffect(() => {
        onRenderedRef.current = onRendered
    })

    useEffect(() => {
        let cancelled = false
        exportToSvg({
            appState: {
                ...scene.appState,
                exportBackground: false,
                exportEmbedScene: false,
                exportWithDarkMode: theme === 'dark',
            },
            elements: scene.elements,
            exportPadding: EXPORT_PADDING,
            files: scene.files,
        })
            .then((svg: SVGSVGElement) => {
                const container = containerRef.current
                if (cancelled || !container) {
                    return
                }
                // Use the drawing's real size (exportToSvg doubles it with width / height attributes)
                const viewBox = svg.getAttribute('viewBox')?.split(' ')
                if (viewBox?.length === 4) {
                    svg.setAttribute('width', viewBox[2])
                    svg.setAttribute('height', viewBox[3])
                }
                svg.setAttribute('class', 'ink-excalidraw-svg')
                svg.setAttribute('role', 'img')
                svg.setAttribute('aria-label', 'Drawing')
                container.replaceChildren(svg)
                onRenderedRef.current?.()
            })
            .catch((error: unknown) => {
                console.error('Could not render the drawing', error)
                if (!cancelled) {
                    setFailed(true)
                }
            })
        return () => {
            cancelled = true
        }
    }, [scene, theme])

    if (failed) {
        return <div className="ink-excalidraw-preview__error">This drawing could not be displayed.</div>
    }

    return <div className="ink-excalidraw-svg-container" ref={containerRef} />
}

export default ExcalidrawSvg
