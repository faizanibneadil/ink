import type { CloudflareBindings } from './types'

/**
 * Node.js (local `pnpm dev`, Payload CLI) implementation.
 *
 * Locally there is no connection to Cloudflare at all: this returns `undefined`
 * and `payload.config.ts` falls back to local SQLite + local disk uploads.
 *
 * The only exception is CI, which sets `CLOUDFLARE_REMOTE_BINDINGS=true` so the
 * Payload CLI (`payload migrate`) can reach the real D1 database through
 * wrangler's platform proxy.
 *
 * In the Worker build this module is swapped for `cloudflare-env.worker.ts`
 * by an alias in `vite.config.ts`.
 */
export async function getCloudflareBindings(): Promise<CloudflareBindings | undefined> {
  if (process.env.CLOUDFLARE_REMOTE_BINDINGS !== 'true') {
    return undefined
  }

  // Indirect specifier so Vite never tries to bundle wrangler.
  const { getPlatformProxy } = await import(/* @vite-ignore */ `${'__wrangler'.replaceAll('_', '')}`)
  const proxy = await getPlatformProxy({
    environment: process.env.CLOUDFLARE_ENV || undefined,
    remoteBindings: true,
  })

  return proxy.env as CloudflareBindings
}
