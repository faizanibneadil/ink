/**
 * Keys of code blocks inserted just now (slash menu, "+" dropdown, ``` shortcut): their Monaco editor
 * gets the focus as soon as it is ready, so the user can type the code right away.
 * Code blocks loaded with a saved note are not in this set and do not steal the focus.
 */
const focusOnMount = new Set<string>()

export const markFocusOnMount = (nodeKey: string) => {
    focusOnMount.add(nodeKey)
}

/** `true` once for a code block inserted just now */
export const takeFocusOnMount = (nodeKey: string): boolean => focusOnMount.delete(nodeKey)
