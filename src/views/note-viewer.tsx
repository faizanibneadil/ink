'use client'

import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'
import type { Note } from '@/payload-types'

import { RichText } from '@payloadcms/richtext-lexical/react'

import { views } from './config'

// `views` comes from a 'use client' module, so it can only be read on the client.
// Reading it in the server component (note.tsx) gives an RSC client reference where `views.default` is undefined.
export const NoteViewer: React.FC<{ note: Note['note'] }> = ({ note }) => {
    return (
        <RichText className="notion-content" data={note as DefaultTypedEditorState} nodeMap={views.default.nodes} />
    )
}
