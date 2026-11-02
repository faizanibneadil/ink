/**
 * Native code block feature (Lexical node + Monaco editor, no Payload block, nothing loaded from the
 * database).
 *
 * - server/  node without React + the server feature (used in the collection config)
 * - client/  editor node, client feature (slash menu, "+" dropdown, ``` shortcut), insert plugin
 * - editor/  code block UI inside the Payload editor (Monaco, language dropdown, copy, collapse, remove)
 * - viewer/  read-only note view (Notion-style component, highlight.js, styles, JSX converter)
 * - shared/  languages and icons used by both editor and viewer
 */
export { CodeBlockFeature } from './server/feature.server'
export type { SerializedCodeBlockNode } from './server/CodeBlockServerNode'
export { codeLanguages, type CodeLanguage } from './shared/languages'
