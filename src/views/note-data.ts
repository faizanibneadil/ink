import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { Note, User } from '@/payload-types'

/**
 * The note at `/<slug>`, as `user` may read it (`null` = guest). Shared by the Payload route
 * (src/app/(payload)/[[...segments]]/page.tsx) and the guest website (src/app/(site)/site/[[...segments]]/page.tsx).
 */
export const findNoteBySlug = async (slug: string, user: null | User): Promise<Note | null> => {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'notes',
    depth: 1,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    user,
    where: { slug: { equals: slug } },
  })
  return docs[0] ?? null
}
