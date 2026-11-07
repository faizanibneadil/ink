import type { CollectionAfterDeleteHook, CollectionBeforeOperationHook, CollectionConfig } from 'payload'

import { createFolderField, createTagField, ValidationError } from 'payload'

import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, TOO_LARGE_MESSAGE } from './media-rules'

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

/**
 * Refuses files over 10 MB on every create / update that carries a file (REST, admin, local API), before anything is
 * stored. The file type is checked by Payload itself (`upload.mimeTypes` below), from the file's content.
 */
const limitFileSize: CollectionBeforeOperationHook = ({ args, req }) => {
  const file = req.file
  if (!file) return args
  const size = typeof file.size === 'number' ? file.size : (file.data?.length ?? 0)
  if (size > MAX_IMAGE_BYTES) {
    throw new ValidationError({ errors: [{ message: TOO_LARGE_MESSAGE, path: 'file' }] }, req.t)
  }
  return args
}

export const Media: CollectionConfig = {
  slug: 'media',
  hooks: {
    afterDelete: [clearNoteReferences],
    beforeOperation: [limitFileSize],
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
  upload: {
    // Images only, for everyone (admins too). Payload checks the file's content, not only its name / declared type,
    // so a renamed file is refused as well. SVG is not allowed (it can carry scripts). See ./media-rules.ts
    mimeTypes: [...ACCEPTED_IMAGE_TYPES],
  },
}
