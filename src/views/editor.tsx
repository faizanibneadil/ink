'use client'

import type { DefaultNodeTypes, DefaultTypedEditorState } from '@payloadcms/richtext-lexical'
import type { Note, User } from '@/payload-types'

import { buildEditorState, RenderLexical, RichTextViewProvider } from '@payloadcms/richtext-lexical/client'
import { DocumentInfoProvider } from '@payloadcms/ui'
import { useState } from 'react'

import { NOTION_VIEW } from './config'
import type { NoteHeaderData } from './note-header/header-data'
import { NoteHeader } from './note-header/NoteHeader'

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

const NoteEditor: React.FC<{ note?: Note['note'] }> = ({ note }) => {
    const [initialValue] = useState<DefaultTypedEditorState>(() => {
        return (note as DefaultTypedEditorState | null | undefined) ?? buildEditorState<DefaultNodeTypes>({ text: '' })
    })
    const [value, setValue] = useState<DefaultTypedEditorState | undefined>(initialValue)

    return (
        // Forces the field to the `notion` view (./config.tsx) and hides Payload's view selector
        <RichTextViewProvider currentView={NOTION_VIEW} inheritable>
            <RenderLexical
                field={{ name: 'note' }}
                initialValue={initialValue}
                schemaPath="collection.notes.note"
                // Payload types `setValue` as a form-field setter (`(value: unknown) => void`)
                setValue={setValue as SetValue}
                value={value}
            />
        </RichTextViewProvider>
    )
}

export const Editor: React.FC<Props> = ({ header, id, note, user }) => {
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
                <NoteHeader header={header} />
                <div className="note-page note-page--editor">
                    <NoteEditor note={note} />
                </div>
            </article>
        </DocumentInfoProvider>
    )
}
