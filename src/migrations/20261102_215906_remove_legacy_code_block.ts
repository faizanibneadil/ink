import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Guard for the removal of the legacy Payload `CodeBlock` block (`BlocksFeature`), replaced by the
 * native Code Block (src/features/code-block). Read-only: it never writes to the database.
 *
 * Legacy blocks were stored inline in `notes.note` (`blocksAsJSON`), as
 * `{ "type": "block", "fields": { "blockType": "CodeBlock", ... } }`. Without `BlocksFeature` a note
 * that still contains one cannot be loaded, so this migration checks every note first. If any Payload
 * block is still there it fails and lists the notes (id / slug): CI then stops before the deploy, and
 * the running version (which still supports the legacy block) stays online until they are converted.
 *
 * No schema change: `payload migrate:create` found none for removing the block from the config.
 */

type LexicalNode = {
    children?: unknown
    fields?: { blockType?: unknown }
    type?: unknown
}

const BLOCK_NODE_TYPES = new Set(['block', 'inlineBlock'])

/** Payload block nodes (`block` / `inlineBlock`) anywhere in the editor state, as their block types */
const findBlocks = (node: unknown, found: string[] = []): string[] => {
    if (!node || typeof node !== 'object') {
        return found
    }
    const lexicalNode = node as LexicalNode
    if (typeof lexicalNode.type === 'string' && BLOCK_NODE_TYPES.has(lexicalNode.type)) {
        found.push(String(lexicalNode.fields?.blockType ?? 'unknown'))
    }
    if (Array.isArray(lexicalNode.children)) {
        for (const child of lexicalNode.children) {
            findBlocks(child, found)
        }
    }
    return found
}

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
    const rows = (await db.all(sql`SELECT \`id\`, \`slug\`, \`note\` FROM \`notes\` ORDER BY \`id\`;`)) as {
        id: number
        note: null | string
        slug: null | string
    }[]

    const problems: string[] = []

    for (const row of rows) {
        if (!row.note) {
            continue
        }
        let editorState: { root?: unknown } | null = null
        try {
            editorState = JSON.parse(row.note)
        } catch {
            problems.push(`note id ${row.id} / slug "${row.slug ?? ''}": rich text is not valid JSON`)
            continue
        }
        const blocks = findBlocks(editorState?.root)
        if (blocks.length) {
            problems.push(
                `note id ${row.id} / slug "${row.slug ?? ''}": ${blocks.length} legacy block(s) (${blocks.join(', ')})`,
            )
        }
    }

    if (problems.length) {
        const message = [
            `Legacy code blocks found in ${problems.length} note(s). Convert them to the new Code Block, then run the migration again. Nothing was changed.`,
            ...problems.map((problem) => `  - ${problem}`),
        ].join('\n')
        payload.logger.error(message)
        throw new Error(message)
    }

    payload.logger.info(`No legacy code blocks found in ${rows.length} note(s).`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
    // Nothing to undo: `up` only reads the notes.
}
