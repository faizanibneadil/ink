/**
 * Languages for the CodeBlock, shared by:
 * - payload.config.ts: the language picker in the editor. Keys are the Monaco language ids the
 *   editor uses (https://github.com/microsoft/monaco-editor/tree/main/src/basic-languages).
 *   `js`, `jsx`, `ts` and `tsx` are kept as they were, so code blocks saved before keep their language.
 * - src/views/note-viewer.tsx: the label above the code and the highlight.js grammar used for
 *   syntax highlighting in the read-only view (see `highlightLanguages`).
 */
export const codeLanguages = {
    plaintext: 'Plain Text',
    ts: 'TypeScript',
    tsx: 'TSX',
    js: 'JavaScript',
    jsx: 'JSX',
    json: 'JSON',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    less: 'Less',
    markdown: 'Markdown',
    yaml: 'YAML',
    xml: 'XML',
    graphql: 'GraphQL',
    sql: 'SQL',
    mysql: 'MySQL',
    pgsql: 'PostgreSQL',
    shell: 'Shell',
    powershell: 'PowerShell',
    bat: 'Batch',
    dockerfile: 'Dockerfile',
    ini: 'INI',
    python: 'Python',
    java: 'Java',
    kotlin: 'Kotlin',
    swift: 'Swift',
    'objective-c': 'Objective-C',
    dart: 'Dart',
    go: 'Go',
    rust: 'Rust',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    vb: 'Visual Basic',
    php: 'PHP',
    ruby: 'Ruby',
    perl: 'Perl',
    lua: 'Lua',
    r: 'R',
    scala: 'Scala',
    elixir: 'Elixir',
    protobuf: 'Protobuf',
    handlebars: 'Handlebars',
    twig: 'Twig',
} as const satisfies Record<string, string>

export type CodeLanguage = keyof typeof codeLanguages
