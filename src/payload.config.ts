import { getCloudflareContext } from '@opennextjs/cloudflare'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { r2Storage } from '@payloadcms/storage-r2'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import type { GetPlatformProxyOptions } from 'wrangler'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Folders } from './collections/Folders'
import { Tags } from './collections/Tags'
import { Notes } from './collections/notes'
import { Settings } from './globals/settings'
import { mcp } from './mcp'
import { createCloudflareLogger } from './utilities/cloudflareLogger'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Defined on the Cloudflare Worker (D1 + R2). Undefined on the local machine,
// where Payload uses local SQLite and stores uploads on disk.
const cloudflare = await getCloudflareEnv()

const cloudflareLogger = createCloudflareLogger() as any // eslint-disable-line @typescript-eslint/no-explicit-any -- PayloadLogger type isn't exported

// Public URL of this deployment, used as Payload's `serverURL` and as the only allowed origin for
// CORS and CSRF:
// - production: `vars.SERVER_URL` in wrangler.jsonc (https://ink.devslix.com)
// - Previews: passed by CI with `wrangler preview --var SERVER_URL:<Preview URL>`
// - local: `SERVER_URL` in .env, defaults to http://localhost:3000
const serverURL =
  (cloudflare as { SERVER_URL?: string } | undefined)?.SERVER_URL ||
  process.env.SERVER_URL ||
  (cloudflare ? '' : 'http://localhost:3000')

export default buildConfig({
  serverURL,
  // Only this deployment's own URL may call the API from a browser (CORS) or use the Payload auth
  // cookie (CSRF). Payload also adds `serverURL` to `csrf` itself.
  cors: serverURL ? [serverURL] : [],
  csrf: serverURL ? [serverURL] : [],
  routes: {
    admin: '/',
    api: '/api',
    graphQL: '/api/graphql',
    graphQLPlayground: '/api/graphql-playground',
  },
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname, './app'),
      importMapFile: path.resolve(dirname, './app/importMap.js'),
    },
    meta: { titleSuffix: ' - Ink' },
    components: {
      graphics: {
        Logo: "@/graphics/logo/logo.tsx#Logo",
        Icon: "@/graphics/icon/icon.tsx#Icon"
      }
    }
  },
  // Cloudflare Workers' node:crypto caps PBKDF2 at 100,000 iterations (Payload default is 600,000).
  auth: {
    passwordHashIterations: 100000,
  },
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
      // Local SQLite only (not D1). The dev server and other processes on the same file (Payload CLI, the
      // tests' local API) can write at the same time: wait up to 5s for a lock instead of failing at once with
      // SQLITE_BUSY, and use WAL so readers are not blocked by a writer.
      busyTimeout: 5000,
      wal: true,
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
  // MCP server at /api/mcp: admins only, notes only (see src/mcp.ts)
  plugins: [mcp],
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
