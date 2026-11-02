import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types'

/**
 * Drawing data saved in the Lexical node (`data`), as a JSON string. Same format as the
 * Lexical playground's Excalidraw node: `{ elements, appState, files }`.
 * An empty drawing is `'[]'` (also the playground's default).
 */
export const EMPTY_SCENE_DATA = '[]'

/** Space around the drawing when it is rendered as an SVG */
export const EXPORT_PADDING = 16

export type ExcalidrawScene = {
    appState: Partial<AppState>
    elements: readonly ExcalidrawElement[]
    files: BinaryFiles
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

/** Never throws: broken / unknown data becomes an empty scene. */
export const parseScene = (data: unknown): ExcalidrawScene => {
    if (typeof data === 'string' && data.length > 0) {
        try {
            const parsed: unknown = JSON.parse(data)
            if (isObject(parsed)) {
                return {
                    appState: isObject(parsed.appState) ? (parsed.appState as Partial<AppState>) : {},
                    elements: Array.isArray(parsed.elements)
                        ? (parsed.elements as ExcalidrawElement[]).filter((el) => isObject(el) && !el.isDeleted)
                        : [],
                    files: isObject(parsed.files) ? (parsed.files as BinaryFiles) : {},
                }
            }
        } catch {
            // fall through: empty scene
        }
    }
    return { appState: {}, elements: [], files: {} }
}

/**
 * Builds the data saved in the node. Deleted elements are dropped and images are never saved
 * (images are disabled: they would be stored as base64 inside the note).
 * Returns `null` when nothing is left to save (empty drawing).
 */
export const serializeScene = (
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
): null | string => {
    const kept = elements.filter((el) => !el.isDeleted && el.type !== 'image')
    if (kept.length === 0) {
        return null
    }
    // Only the parts of the app state needed to render the drawing again
    const savedAppState: Partial<AppState> = {}
    if (appState.viewBackgroundColor) {
        savedAppState.viewBackgroundColor = appState.viewBackgroundColor
    }
    if (appState.gridSize) {
        savedAppState.gridSize = appState.gridSize
    }
    return JSON.stringify({ appState: savedAppState, elements: kept, files: {} })
}

/**
 * Approximate width / height of the drawing, without loading Excalidraw. Used to reserve space
 * (no layout jump) before the drawing is rendered.
 */
export const getSceneSize = (
    elements: readonly ExcalidrawElement[],
    padding: number,
): null | { height: number, width: number } => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const el of elements) {
        const x2 = el.x + Math.max(0, el.width)
        const y2 = el.y + Math.max(0, el.height)
        minX = Math.min(minX, el.x, x2)
        minY = Math.min(minY, el.y, y2)
        maxX = Math.max(maxX, el.x, x2)
        maxY = Math.max(maxY, el.y, y2)
    }
    const width = maxX - minX
    const height = maxY - minY
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
        return null
    }
    return { height: height + 2 * padding, width: width + 2 * padding }
}

/** Sum of element versions (deleted ones included): changes whenever the drawing changes. */
export const getSceneVersion = (elements: readonly ExcalidrawElement[]): number =>
    elements.reduce((sum, el) => sum + el.version, 0)
