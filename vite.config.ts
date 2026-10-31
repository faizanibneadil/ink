import { withPayload } from '@payloadcms/tanstack-start'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type PluginOption, type UserConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// `CLOUDFLARE_BUILD=true` is only set by the CI/CD pipeline (see `.github/workflows/deploy.yml`).
// Without it (`pnpm dev`, `pnpm build` locally) this is a plain Node.js app with local SQLite
// and local media; wrangler / workerd are never loaded.
const isCloudflare = process.env.CLOUDFLARE_BUILD === 'true'

export default defineConfig(async (env) => {
  const cloudflarePlugins: PluginOption[] = isCloudflare
    ? [
        (await import('@cloudflare/vite-plugin')).cloudflare({
          // TanStack Start's server entry runs in `ssr`; Payload's RSC environment is imported from it.
          viteEnvironment: { name: 'ssr', childEnvironments: ['rsc'] },
        }),
        {
          name: 'ink:cloudflare-server-environments',
          enforce: 'post',
          configEnvironment(name, config) {
            if (name === 'client') return
            // The Cloudflare plugin resolves with the `browser` condition, which points `payload`
            // at its client-only entry. The server environments need the real server entries.
            if (config.resolve?.conditions) {
              config.resolve.conditions = config.resolve.conditions.filter(
                (condition) => condition !== 'browser',
              )
            }
            // `import.meta.url` is undefined on Workers, but Payload (and its DB adapters) call
            // `fileURLToPath(import.meta.url)` at import time. Give them a stable fake path.
            config.define = { ...config.define, 'import.meta.url': JSON.stringify('file:///worker/index.js') }
          },
        },
      ]
    : []

  const config: UserConfig = withPayload(
    ({ pluginOptions }) => ({
      plugins: [
        ...cloudflarePlugins,
        rsc(pluginOptions.rsc),
        tanstackStart(pluginOptions.tanstackStart),
        viteReact(pluginOptions.react),
      ],
      resolve: {
        alias: [
          ...(isCloudflare
            ? [
                {
                  // Read D1/R2 bindings from `cloudflare:workers` instead of the Node.js implementation.
                  find: /^\.\/lib\/runtime\/cloudflare-env$/,
                  replacement: path.resolve(__dirname, 'src/lib/runtime/cloudflare-env.worker.ts'),
                },
              ]
            : []),
          {
            // Payload's Lexical editor stylesheet (not in the package's `exports`), used by src/views/note.tsx.
            find: /^@payloadcms\/richtext-lexical\/bundled\.css/,
            replacement: path.resolve(__dirname, 'node_modules/@payloadcms/richtext-lexical/dist/field/bundled.css'),
          },
          { find: '@/', replacement: `${path.resolve(__dirname, 'src')}/` },
        ],
      },
      server: {
        port: 3000,
        warmup: {
          clientFiles: [
            './src/app/__root.tsx',
            './src/app/_payload.tsx',
            './src/app/_payload/admin.index.tsx',
            './src/app/_payload/admin.$.tsx',
          ],
        },
      },
    }),
    { payloadConfigPath: path.resolve(__dirname, 'src', 'payload.config.ts') },
  )(env)

  if (isCloudflare) {
    // `withPayload` externalizes Payload's server packages so Node can load them from
    // node_modules. A Worker has no node_modules, so everything must be bundled.
    config.ssr = { ...config.ssr, external: [], noExternal: true }
    for (const name of ['rsc', 'ssr']) {
      const environment = config.environments?.[name]
      if (!environment) continue
      environment.resolve = { ...environment.resolve, external: [], noExternal: true }
      if (environment.build?.rollupOptions) {
        environment.build.rollupOptions.external = []
      }
    }
  }

  return config
})
