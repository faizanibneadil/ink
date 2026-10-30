import type { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import type { R2StorageOptions } from '@payloadcms/storage-r2'

/** Bindings declared in `wrangler.jsonc`. */
export interface CloudflareBindings {
  D1: Parameters<typeof sqliteD1Adapter>[0]['binding']
  R2: R2StorageOptions['bucket']
}
