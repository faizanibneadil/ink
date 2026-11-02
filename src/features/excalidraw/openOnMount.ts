/**
 * Keys of drawing nodes that were just inserted from the toolbar / slash menu. Their component
 * opens the drawing modal right away. Saved drawings (loaded from the database) never open by
 * themselves.
 */
const keys = new Set<string>()

export const markOpenOnMount = (nodeKey: string) => {
    keys.add(nodeKey)
}

export const shouldOpenOnMount = (nodeKey: string) => keys.has(nodeKey)

export const clearOpenOnMount = (nodeKey: string) => {
    keys.delete(nodeKey)
}
