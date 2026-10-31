import './lib/patch-pbkdf2'

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { CodeBlock, lexicalEditor } from '@payloadcms/richtext-lexical'
import { r2Storage } from '@payloadcms/storage-r2'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import type { GetPlatformProxyOptions } from 'wrangler'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Folders } from './collections/Folders'
import { Tags } from './collections/Tags'
import { Whiteboard } from './blocks/whiteboard/config'
import { Notes } from './collections/notes'
import { Settings } from './globals/settings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Defined on the Cloudflare Worker (D1 + R2). Undefined on the local machine,
// where Payload uses local SQLite and stores uploads on disk.
const cloudflare = await getCloudflareEnv()

const createLog =
  (level: string, fn: typeof console.log) => (objOrMsg: object | string, msg?: string) => {
    if (typeof objOrMsg === 'string') {
      fn(JSON.stringify({ level, msg: objOrMsg }))
    } else {
      fn(JSON.stringify({ level, ...objOrMsg, msg: msg ?? (objOrMsg as { msg?: string }).msg }))
    }
  }

const cloudflareLogger = {
  level: process.env.PAYLOAD_LOG_LEVEL || 'info',
  trace: createLog('trace', console.debug),
  debug: createLog('debug', console.debug),
  info: createLog('info', console.log),
  warn: createLog('warn', console.warn),
  error: createLog('error', console.error),
  fatal: createLog('fatal', console.error),
  silent: () => {},
} as any // eslint-disable-line @typescript-eslint/no-explicit-any -- PayloadLogger type isn't exported

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      views: {
        note: {
          path: "/tack",
          Component: "@/views/note.tsx#Note",
        }
      },
      graphics: {
        Logo: "@/graphics/logo/logo.tsx#Logo",
        Icon: "@/graphics/icon/icon.tsx#Icon"
      }
    }
  },
  blocks: [Whiteboard, CodeBlock({
    defaultLanguage: "ts",
    fieldOverrides: {
      slug: "CodeBlock"
    },
    languages: {
      plaintext: "Plain Text",
      js: "JavaScript",
      ts: "TypeScript",
      tsx: "TSX",
      jsx: "JSX"
    }
  })],
  collections: [Users, Media, Folders, Tags, Notes],
  globals: [Settings],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => {
      return [...defaultFeatures]
    }
  }),
  // On the Worker, read the secret from the `env` binding: depending on how the bundle is chunked this
  // module can be evaluated before `process.env` is populated.
  secret: (cloudflare as { PAYLOAD_SECRET?: string } | undefined)?.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: cloudflare
    ? sqliteD1Adapter({
        binding: cloudflare.D1,
        blocksAsJSON: true,
        migrationDir: path.resolve(dirname, 'migrations'),
      })
    : sqliteAdapter({
        blocksAsJSON: true,
        migrationDir: path.resolve(dirname, 'migrations'),
        transactionOptions: {
          behavior: "deferred"
        },
        client: {
          url: process.env.DATABASE_URL || '',
        },
      }),
  logger: cloudflare ? cloudflareLogger : undefined,
  storage: [
    // Disabled locally: uploads go to the local `media/` folder. It is still registered so the
    // fields it adds to `media` exist locally too and both databases share the same schema.
    r2Storage({
      bucket: cloudflare?.R2 as CloudflareEnv['R2'],
      collections: { media: true },
      enabled: Boolean(cloudflare),
    }),
  ],
  localization: {
    locales: [{ code: 'en', label: 'English' }],
    fallback: true,
    defaultLocale: 'en',
  },
  plugins: [mcpPlugin({})],
})

/**
 * - Cloudflare Worker (OpenNext): bindings from `getCloudflareContext`.
 * - CI only (`CLOUDFLARE_REMOTE_BINDINGS=true`, used by `pnpm deploy:migrate` and
 *   `pnpm deploy:migrate:preview`): the Payload CLI reaches the real D1 database through
 *   wrangler's platform proxy.
 * - Everywhere else (local `pnpm dev`, `next build`, Payload CLI): `undefined`, so Payload uses
 *   local SQLite and local disk uploads. There is no connection to Cloudflare at all.
 */
async function getCloudflareEnv(): Promise<CloudflareEnv | undefined> {
  if (process.env.CLOUDFLARE_REMOTE_BINDINGS === 'true') {
    // Adapted from the official Payload `with-cloudflare-d1` template.
    // Indirect specifier so the bundler never tries to bundle wrangler.
    const { getPlatformProxy } = await import(
      /* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`
    )
    const proxy = await getPlatformProxy({
      // `wrangler.preview-migrations.jsonc` for the Preview database, wrangler.jsonc otherwise.
      configPath: process.env.CLOUDFLARE_WRANGLER_CONFIG || undefined,
      environment: process.env.CLOUDFLARE_ENV || undefined,
      remoteBindings: true,
    } satisfies GetPlatformProxyOptions)
    return proxy.env as CloudflareEnv
  }

  const isWorker = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'
  if (isWorker) {
    return (await getCloudflareContext({ async: true })).env
  }

  return undefined
}
