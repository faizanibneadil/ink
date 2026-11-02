/**
 * Excalidraw drawing feature (native Lexical node, no Payload block).
 *
 * - server/  node without React + the server feature (used in the collection config)
 * - client/  editor node, client feature (slash menu, "+" dropdown), insert plugin
 * - editor/  drawing UI inside the Payload editor (preview, Edit / Delete, full screen modal)
 * - viewer/  read-only note view (component + JSX converter)
 * - shared/  scene helpers, SVG preview, styles and icon used by both editor and viewer
 */
export { ExcalidrawFeature } from './server/feature.server'
export type { SerializedExcalidrawNode } from './server/ExcalidrawServerNode'
