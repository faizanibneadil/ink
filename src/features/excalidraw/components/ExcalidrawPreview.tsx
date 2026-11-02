'use client'

import dynamic from 'next/dynamic'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { EXPORT_PADDING, type ExcalidrawScene, getSceneSize } from '../scene'

// Excalidraw (and its export code) is only downloaded when a drawing becomes visible
const ExcalidrawSvg = dynamic(() => import('./ExcalidrawSvg'), { ssr: false })

type Props = {
    scene: ExcalidrawScene
    theme: 'dark' | 'light'
}

/**
 * Read-only drawing, rendered lazily: nothing is loaded until the drawing is (almost) in the
 * viewport. Space is reserved with the drawing's aspect ratio, so the page does not jump.
 */
export const ExcalidrawPreview: React.FC<Props> = ({ scene, theme }) => {
    const ref = useRef<HTMLDivElement>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [isRendered, setIsRendered] = useState(false)
    const size = useMemo(() => getSceneSize(scene.elements, EXPORT_PADDING), [scene.elements])

    useEffect(() => {
        const element = ref.current
        if (!element || isVisible) {
            return
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setIsVisible(true)
                    observer.disconnect()
                }
            },
            { rootMargin: '200px 0px' },
        )
        observer.observe(element)
        return () => observer.disconnect()
    }, [isVisible])

    return (
        <div
            className={`ink-excalidraw-preview${isRendered ? ' ink-excalidraw-preview--rendered' : ''}`}
            ref={ref}
            style={
                !isRendered && size
                    ? { aspectRatio: `${size.width} / ${size.height}`, width: `${size.width}px` }
                    : undefined
            }
        >
            {isVisible ? <ExcalidrawSvg onRendered={() => setIsRendered(true)} scene={scene} theme={theme} /> : null}
        </div>
    )
}
