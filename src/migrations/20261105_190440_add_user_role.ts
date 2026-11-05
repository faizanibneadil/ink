import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

import { getReservedSlugs } from '../utilities/isPayloadRoute'

/**
 * Payload admin + website on `/` (src/app/[[...segments]]/page.tsx):
 *
 * 1. Guard (read-only, runs first, since D1 has no transactions): notes are now shown at `/<slug>`. A note whose slug
 *    is a Payload admin route (`login`, `collections`, `account`, ...) would be hidden by that Payload page. If one
 *    exists, the migration fails and lists it, so CI stops before deploying. Rename those slugs, then deploy again.
 * 2. `users.role` (`admin` | `user`, default `user`). The Payload admin is admins-only.
 * 3. Every user that exists before this migration becomes `admin` (until now every user could use the admin).
 */
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  const reserved = getReservedSlugs(payload.config)
  const notes = (await db.all(sql`SELECT \`id\`, \`slug\` FROM \`notes\` WHERE \`slug\` IS NOT NULL;`)) as {
    id: number
    slug: string
  }[]
  const clashes = notes.filter((note) => reserved.has(note.slug.toLowerCase()))
  if (clashes.length > 0) {
    throw new Error(
      `Note slug(s) clash with Payload admin routes and would be unreachable at /<slug>:\n` +
        clashes.map((note) => `  - note id ${note.id}: "${note.slug}"`).join('\n') +
        `\nRename these slugs, then run the migration again.`,
    )
  }
  payload.logger.info(`No note slug clashes with a Payload admin route (${notes.length} note(s) checked).`)

  await db.run(sql`ALTER TABLE \`users\` ADD \`role\` text DEFAULT 'user' NOT NULL;`)
  await db.run(sql`UPDATE \`users\` SET \`role\` = 'admin';`)
  payload.logger.info('Added users.role; all existing users are now admins.')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`role\`;`)
}
