import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

import { slugifyNote, slugifyText } from '../collections/note-slug'

/**
 * Adds the native slug field to `notes` (unique + indexed).
 *
 * SQLite / D1 cannot add a NOT NULL column without a default, so the column gets an empty default,
 * every existing note is given a slug (same rules as the field: first heading / paragraph, `-N`
 * when taken, `note-N` when there is no usable text), and only then is the unique index created.
 * New notes always get their slug from the field's hook.
 */
export async function up({ db, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`notes\` ADD \`slug\` text DEFAULT '' NOT NULL;`)

  const rows = (await db.all(sql`SELECT \`id\`, \`note\` FROM \`notes\` ORDER BY \`id\`;`)) as {
    id: number
    note: null | string
  }[]

  const taken = new Set<string>()
  const firstFree = (base: string, startIndex: number) => {
    for (let index = startIndex; ; index++) {
      const candidate = index === 0 ? base : `${base}-${index}`
      if (!taken.has(candidate)) {
        return candidate
      }
    }
  }
  const fallbackBase = slugifyText('Note')

  for (const row of rows) {
    let editorState: unknown = null
    try {
      editorState = row.note ? JSON.parse(row.note) : null
    } catch {
      // unreadable rich text: fallback slug
    }
    const derived = await slugifyNote({ data: {}, req, valueToSlugify: editorState })
    const slug = derived ? firstFree(derived, 0) : firstFree(fallbackBase, 1)
    taken.add(slug)
    await db.run(sql`UPDATE \`notes\` SET \`slug\` = ${slug} WHERE \`id\` = ${row.id};`)
  }

  await db.run(sql`CREATE UNIQUE INDEX \`notes_slug_idx\` ON \`notes\` (\`slug\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`notes_slug_idx\`;`)
  await db.run(sql`ALTER TABLE \`notes\` DROP COLUMN \`slug\`;`)
}
