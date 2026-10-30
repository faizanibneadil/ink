import { env } from 'cloudflare:workers'

import type { CloudflareBindings } from './types'

/** Cloudflare Worker implementation: bindings come straight from the Workers runtime. */
export async function getCloudflareBindings(): Promise<CloudflareBindings | undefined> {
  return env as unknown as CloudflareBindings
}
