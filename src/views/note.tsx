import React from "react"
import type { Note as NoteType } from "@/payload-types"
import type { AdminViewServerProps } from "payload"

const NoteViewer = React.lazy(() => import("./note-viewer").then(module => ({
    default: module.NoteViewer
})))
const Editor = React.lazy(() => import("./editor").then(module => ({
    default: module.Editor
})))

export const Note: React.FC<AdminViewServerProps> = async ({ params, payload, user }) => {
    // /admin/tack/<slug>
    const slug = params?.segments?.[1]

    if (!slug) {
        return 'Note is null'
    }

    let note: NoteType | null = null
    try {
        const { docs } = await payload.find({
            collection: 'notes',
            limit: 1,
            pagination: false,
            where: { slug: { equals: slug } },
        })
        note = docs[0] ?? null
    } catch {
        // not found
    }

    if (!note) {
        return 'Note not found'
    }

    if (user) {
        return <Editor key={note.id} id={note.id} note={note.note} user={user} />
    }

    // Reading layout (width, padding, responsive sizing) lives in note-viewer.css
    return <NoteViewer note={note.note} />

}