import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Fixes login for users whose password was set before Payload 4.0.0-beta.7.
 *
 * Payload 4.0.0-beta.6 always hashed passwords with 600,000 PBKDF2 iterations and stored them with the
 * `pbkdf2-sha256-v1:` prefix. Cloudflare Workers refuse more than 100,000 iterations, so the old
 * `src/lib/patch-pbkdf2.ts` silently clamped every hash to 100,000 — while Payload still labelled it
 * `pbkdf2-sha256-v1:` (= 600,000). The patch was active since the first Workers deploy, so every
 * `pbkdf2-sha256-v1:` hash in D1 was really computed with 100,000 iterations.
 *
 * Since 4.0.0-beta.7 (`auth.passwordHashIterations: 100000`), Payload reads the iteration count from the
 * prefix: it verifies those hashes with 600,000 iterations, which Workers reject (and which would not
 * match anyway), so those users cannot log in. Relabel them with the prefix Payload uses for
 * 100,000 iterations (`pbkdf2-sha256-100k-v1:`). The hash bytes are unchanged; only the label is fixed.
 *
 * Legacy hashes without a prefix (25,000 iterations) are untouched; Payload still verifies them.
 */

const OLD_PREFIX = 'pbkdf2-sha256-v1:'
const NEW_PREFIX = 'pbkdf2-sha256-100k-v1:'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  const result = await db.run(sql`
    UPDATE \`users\`
    SET \`hash\` = ${NEW_PREFIX} || substr(\`hash\`, ${OLD_PREFIX.length + 1})
    WHERE substr(\`hash\`, 1, ${OLD_PREFIX.length}) = ${OLD_PREFIX};
  `)
  const changes = (result as { meta?: { changes?: number }; rowsAffected?: number } | undefined)
  payload.logger.info(
    `Relabelled clamped password hashes: ${changes?.meta?.changes ?? changes?.rowsAffected ?? 'unknown'} user(s).`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`
    UPDATE \`users\`
    SET \`hash\` = ${OLD_PREFIX} || substr(\`hash\`, ${NEW_PREFIX.length + 1})
    WHERE substr(\`hash\`, 1, ${NEW_PREFIX.length}) = ${NEW_PREFIX};
  `)
}
