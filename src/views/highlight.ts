/**
 * Syntax highlighting for the read-only CodeBlock (src/views/note-viewer.tsx).
 *
 * highlight.js core with only the grammars for the languages in src/blocks/code/languages.ts, so the
 * bundle stays small. It is synchronous, so the highlighted code is already in the server-rendered HTML.
 * Colours come from note-viewer.css (`.hljs-*` classes), for light and dark theme.
 */
import type { LanguageFn } from 'highlight.js'

import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import dart from 'highlight.js/lib/languages/dart'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import dos from 'highlight.js/lib/languages/dos'
import elixir from 'highlight.js/lib/languages/elixir'
import go from 'highlight.js/lib/languages/go'
import graphql from 'highlight.js/lib/languages/graphql'
import handlebars from 'highlight.js/lib/languages/handlebars'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import less from 'highlight.js/lib/languages/less'
import lua from 'highlight.js/lib/languages/lua'
import markdown from 'highlight.js/lib/languages/markdown'
import objectivec from 'highlight.js/lib/languages/objectivec'
import perl from 'highlight.js/lib/languages/perl'
import pgsql from 'highlight.js/lib/languages/pgsql'
import php from 'highlight.js/lib/languages/php'
import plaintext from 'highlight.js/lib/languages/plaintext'
import powershell from 'highlight.js/lib/languages/powershell'
import protobuf from 'highlight.js/lib/languages/protobuf'
import python from 'highlight.js/lib/languages/python'
import r from 'highlight.js/lib/languages/r'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import scala from 'highlight.js/lib/languages/scala'
import scss from 'highlight.js/lib/languages/scss'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import twig from 'highlight.js/lib/languages/twig'
import typescript from 'highlight.js/lib/languages/typescript'
import vbnet from 'highlight.js/lib/languages/vbnet'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

import type { CodeLanguage } from '@/blocks/code/languages'

const grammars: Record<string, LanguageFn> = {
    bash, c, cpp, csharp, css, dart, dockerfile, dos, elixir, go, graphql, handlebars, ini, java, javascript,
    json, kotlin, less, lua, markdown, objectivec, perl, pgsql, php, plaintext, powershell, protobuf, python, r,
    ruby, rust, scala, scss, sql, swift, twig, typescript, vbnet, xml, yaml,
}

for (const [name, grammar] of Object.entries(grammars)) {
    if (!hljs.getLanguage(name)) {
        hljs.registerLanguage(name, grammar)
    }
}

/** CodeBlock language (Monaco id) -> highlight.js grammar */
const highlightLanguages: Record<CodeLanguage, string> = {
    plaintext: 'plaintext',
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'xml',
    css: 'css',
    scss: 'scss',
    less: 'less',
    markdown: 'markdown',
    yaml: 'yaml',
    xml: 'xml',
    graphql: 'graphql',
    sql: 'sql',
    mysql: 'sql',
    pgsql: 'pgsql',
    shell: 'bash',
    powershell: 'powershell',
    bat: 'dos',
    dockerfile: 'dockerfile',
    ini: 'ini',
    python: 'python',
    java: 'java',
    kotlin: 'kotlin',
    swift: 'swift',
    'objective-c': 'objectivec',
    dart: 'dart',
    go: 'go',
    rust: 'rust',
    c: 'c',
    cpp: 'cpp',
    csharp: 'csharp',
    vb: 'vbnet',
    php: 'php',
    ruby: 'ruby',
    perl: 'perl',
    lua: 'lua',
    r: 'r',
    scala: 'scala',
    elixir: 'elixir',
    protobuf: 'protobuf',
    handlebars: 'handlebars',
    twig: 'twig',
}

const escapeHTML = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Splits highlighted HTML into one HTML string per line. Tokens that span lines (block comments,
 * template strings) are closed at the end of a line and reopened on the next, so every line is valid HTML.
 */
const splitLines = (html: string): string[] => {
    const lines: string[] = []
    const open: string[] = []
    let current = ''
    const tag = /<span[^>]*>|<\/span>|\n|[^<\n]+/g
    let match: null | RegExpExecArray
    while ((match = tag.exec(html))) {
        const token = match[0]
        if (token === '\n') {
            lines.push(current + '</span>'.repeat(open.length))
            current = open.join('')
        } else if (token === '</span>') {
            open.pop()
            current += token
        } else if (token.startsWith('<span')) {
            open.push(token)
            current += token
        } else {
            current += token
        }
    }
    lines.push(current)
    return lines
}

/**
 * Returns the code as highlighted HTML, one string per line. The HTML only contains `<span class="hljs-*">`
 * tags and escaped text (highlight.js escapes the code), so it is safe for dangerouslySetInnerHTML.
 */
export const highlightLines = (code: string, language?: null | string): string[] => {
    const grammar = language ? highlightLanguages[language as CodeLanguage] : undefined
    let html: string
    try {
        html = grammar && hljs.getLanguage(grammar)
            ? hljs.highlight(code, { ignoreIllegals: true, language: grammar }).value
            : escapeHTML(code)
    } catch {
        html = escapeHTML(code)
    }
    // A trailing newline would add an empty last line
    return splitLines(html.replace(/\n$/, ''))
}
