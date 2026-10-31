import React from "react"
import type { Note as NoteType } from "@/payload-types"
import type { AdminViewServerProps } from "payload"

// Payload's Lexical editor CSS. The editor loads it only when it renders, so the read-only view links it itself.
import editorStyles from "@payloadcms/richtext-lexical/bundled.css?url"

const NoteViewer = React.lazy(() => import("./note-viewer").then(module => ({
    default: module.NoteViewer
})))
const Editor = React.lazy(() => import("./editor").then(module => ({
    default: module.Editor
})))

export const Note: React.FC<AdminViewServerProps> = async ({ params, payload, user }) => {
    const id = params?.segments?.[1]

    if (!id) {
        return 'Note is null'
    }

    let note: NoteType | null = null
    try {
        note = await payload.findByID({ collection: 'notes', id })
    } catch {
        // not found
    }

    if (!note) {
        return 'Note not found'
    }

    if (user) {
        return <Editor key={note.id} id={note.id} note={note.note} user={user} />
    }

    return (
        <div style={{ width: '100%', marginLeft: 'auto', marginRight: 'auto', maxWidth: '60vw', paddingTop: '6rem' }}>
            <link rel="stylesheet" href={editorStyles} precedence="default" />
            <NoteViewer note={note.note} />
        </div>
    )
}