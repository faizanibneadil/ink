import React from "react"
import type { Note as NoteType } from "@/payload-types"
import type { AdminViewServerProps } from "payload"

import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import { views } from "./config"

const RichText = React.lazy(() => import('@payloadcms/richtext-lexical/react').then(module => ({
    default: module.RichText
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
            <RichText className="notion-content" data={note.note as DefaultTypedEditorState} nodeMap={views.default.nodes} />
        </div>
    )
}