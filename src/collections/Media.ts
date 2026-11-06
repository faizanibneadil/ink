import type { CollectionAfterDeleteHook, CollectionConfig } from 'payload'

import { createFolderField, createTagField } from 'payload'

/** Note fields that point to a media file (the Notion-style page header, src/collections/notes.ts). */
const NOTE_MEDIA_FIELDS = ['cover', 'icon'] as const

/**
 * A deleted file is no longer a note's cover / icon. On D1 the foreign key (`ON DELETE set null`) already does this;
 * local SQLite does not enforce foreign keys, so without this hook a note would keep the id of a file that is gone.
 */
const clearNoteReferences: CollectionAfterDeleteHook = async ({ id, req }) => {
  for (const field of NOTE_MEDIA_FIELDS) {
    await req.payload.update({
      collection: 'notes',
      data: { [field]: null },
      depth: 0,
      overrideAccess: true,
      req,
      where: { [field]: { equals: id } },
    })
  }
}

export const Media: CollectionConfig = {
  slug: 'media',
  hooks: {
    afterDelete: [clearNoteReferences],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    createFolderField({ relationTo: 'folders' }),
    createTagField({ relationTo: 'tags' }),
  ],
  upload: true,
}
