/**
 * Languages of the code block, shared by:
 * - the native Code Block (../editor/CodeBlockComponent.tsx): the language dropdown and the Monaco
 *   language (see `toMonacoLanguage`).
 * - the legacy Payload `CodeBlock` block (src/payload.config.ts): its language picker.
 * - the read-only note view (../viewer): the label above the code and the highlight.js grammar
 *   (see `highlightLanguages` in ../viewer/highlight.ts).
 *
 * Keys are Monaco language ids (https://github.com/microsoft/monaco-editor/tree/main/src/basic-languages),
 * except `js`, `jsx`, `ts` and `tsx`, kept as they were so code blocks saved before keep their language.
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

export const DEFAULT_CODE_LANGUAGE: CodeLanguage = 'ts'

export const isCodeLanguage = (value: unknown): value is CodeLanguage =>
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(codeLanguages, value)

/** Short keys that are not Monaco language ids */
const monacoLanguages: Partial<Record<CodeLanguage, string>> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
}

/** Code block language -> Monaco language id */
export const toMonacoLanguage = (language: CodeLanguage): string => monacoLanguages[language] ?? language

/** Extra names accepted by the ``` markdown shortcut (```javascript, ```py, ```bash ...) */
const languageAliases: Record<string, CodeLanguage> = {
    javascript: 'js',
    typescript: 'ts',
    py: 'python',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    yml: 'yaml',
    md: 'markdown',
    'c++': 'cpp',
    'c#': 'csharp',
    cs: 'csharp',
    rb: 'ruby',
    rs: 'rust',
    kt: 'kotlin',
    postgres: 'pgsql',
    postgresql: 'pgsql',
    text: 'plaintext',
    txt: 'plaintext',
}

/** Language typed after ``` -> code block language (by key, label or alias, any case). `undefined` if unknown. */
export const findCodeLanguage = (name: string): CodeLanguage | undefined => {
    const search = name.trim().toLowerCase()
    if (!search) {
        return undefined
    }
    if (isCodeLanguage(search)) {
        return search
    }
    if (languageAliases[search]) {
        return languageAliases[search]
    }
    const byLabel = Object.entries(codeLanguages).find(([, label]) => label.toLowerCase() === search)
    return byLabel?.[0] as CodeLanguage | undefined
}
