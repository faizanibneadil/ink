'use client'

import type { DefaultNodeTypes, DefaultTypedEditorState } from '@payloadcms/richtext-lexical'
import type { User } from 'payload'

import { buildEditorState, RenderLexical } from '@payloadcms/richtext-lexical/client'
import { DocumentInfoProvider } from '@payloadcms/ui'
import { useState } from 'react'

type Props = {
    id: number | string
    note?: DefaultTypedEditorState | null
    user: User
}

const NoteEditor: React.FC<{ note?: DefaultTypedEditorState | null }> = ({ note }) => {
    const [initialValue] = useState<DefaultTypedEditorState>(() => {
        return note ?? buildEditorState<DefaultNodeTypes>({ text: '' })
    })
    const [value, setValue] = useState<DefaultTypedEditorState | undefined>(initialValue)

    return (
        <RenderLexical
            field={{ name: 'note' }}
            initialValue={initialValue}
            schemaPath="collection.notes.note"
            setValue={setValue as any}
            value={value}
        />
    )
}

export const Editor: React.FC<Props> = ({ id, note, user }) => {
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
            <div
                style={{
                    width: '100%',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    maxWidth: '60vw',
                    paddingTop: '6rem',
                    paddingBottom: '6rem',
                }}
            >
                <NoteEditor note={note} />
            </div>
        </DocumentInfoProvider>
    )
}