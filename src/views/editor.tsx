'use client'

import type { DefaultNodeTypes, DefaultTypedEditorState } from '@payloadcms/richtext-lexical'
import type { Note, User } from '@/payload-types'

import { buildEditorState, RenderLexical, RichTextViewProvider } from '@payloadcms/richtext-lexical/client'
import { getNearestEditorFromDOMNode } from '@payloadcms/richtext-lexical/lexical'
import { DocumentInfoProvider } from '@payloadcms/ui'
import { useCallback, useRef, useState } from 'react'

import { getNoteFirstLine } from '@/collections/note-text'

import { NOTION_VIEW } from './config'
import { SaveStatus } from './note-autosave/SaveStatus'
import { useNoteAutosave } from './note-autosave/useNoteAutosave'
import { EditableNoteHeader } from './note-header/EditableNoteHeader'
import type { NoteHeaderData } from './note-header/header-data'

// Same reading layout as the guest view (`.note-page`, `.note-view__*`) + editor-only tweaks
import './note-viewer.css'
import './note-editor.css'

type Props = {
    header: NoteHeaderData
    id: number | string
    note?: Note['note']
    user: User
}

type SetValue = NonNullable<React.ComponentProps<typeof RenderLexical>['setValue']>

const NoteEditor: React.FC<{ id: number | string, note?: Note['note'], onTitle: (title: string) => void }> = ({
    id,
    note,
    onTitle,
}) => {
    const [initialValue] = useState<DefaultTypedEditorState>(() => {
        return (note as DefaultTypedEditorState | null | undefined) ?? buildEditorState<DefaultNodeTypes>({ text: '' })
    })
    const containerRef = useRef<HTMLDivElement>(null)
    // The editor's state right now (not the one Payload hands over in idle time): saved when the page is left
    const readLatest = useCallback(() => {
        const root = containerRef.current?.querySelector('[data-lexical-editor="true"]')
        const editor = root ? getNearestEditorFromDOMNode(root) : null
        return editor ? (editor.getEditorState().toJSON() as DefaultTypedEditorState) : undefined
    }, [])
    // The saved value: an empty note (`null`) counts as saved too, so opening it saves nothing
    const autosave = useNoteAutosave<DefaultTypedEditorState | null | undefined>(
        id,
        note as DefaultTypedEditorState | null | undefined,
        { readLatest },
    )

    const { onChange: autosaveChange } = autosave
    // The editor owns its state: changes are not mirrored into React state (that re-rendered the whole Payload field
    // tree on every change, for nothing: Lexical reads `value` only at mount)
    const onValue = useCallback(
        (next: DefaultTypedEditorState | undefined) => {
            autosaveChange(next)
            onTitle(getNoteFirstLine(next))
        },
        [autosaveChange, onTitle],
    )

    return (
        <div ref={containerRef}>
            <SaveStatus onRetry={autosave.retry} snapshot={autosave.snapshot} />
            {/* Forces the field to the `notion` view (./config.tsx) and hides Payload's view selector */}
            <RichTextViewProvider currentView={NOTION_VIEW} inheritable>
                <RenderLexical
                    field={{ name: 'note' }}
                    initialValue={initialValue}
                    schemaPath="collection.notes.note"
                    // Payload types `setValue` as a form-field setter (`(value: unknown) => void`)
                    setValue={onValue as SetValue}
                    // Always the same reference: Payload's field never sees a new value, so it never re-mounts the editor
                    value={initialValue}
                />
            </RichTextViewProvider>
        </div>
    )
}

export const Editor: React.FC<Props> = ({ header, id, note, user }) => {
    // Title (first line) as the user types: alt text of an uploaded cover / icon
    const title = useRef(getNoteFirstLine(note))
    const onTitle = useCallback((next: string) => {
        title.current = next
    }, [])
    const getTitle = useCallback(() => title.current, [])

    return (
        <DocumentInfoProvider
            collectionSlug="notes"
            currentEditor={user}
            hasPublishedDoc={false}
            id={id}
            isLocked={false}
            lastUpdateTime={0}
            mostRecentVersionIsAutosaved={false}
            unpublishedVersionCount={0}
            versionCount={0}
        >
            <article className="note-doc note-doc--editor">
                <EditableNoteHeader getTitle={getTitle} header={header} noteId={id} />
                <div className="note-page note-page--editor">
                    <NoteEditor id={id} note={note} onTitle={onTitle} />
                </div>
            </article>
        </DocumentInfoProvider>
    )
}
