'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { NoteHeaderData, NoteHeaderImage } from './header-data'
import { type HeaderImageField, uploadHeaderImage } from './header-images'
import { ImagePicker } from './ImagePicker'

import './note-header.css'

type Props = {
    /** Current title of the note (first line of the content), used for the uploaded file's alt text */
    getTitle: () => string
    header: NoteHeaderData
    noteId: number | string
}

type PickerState = { field: HeaderImageField; trigger: HTMLElement | null }

const cx = (...classes: (false | null | string | undefined)[]) => classes.filter(Boolean).join(' ')

/**
 * The note header in the editor: same layout as the read-only header (NoteHeader.tsx), plus Notion's controls.
 * "Add icon" / "Add cover" show on hover (always on touch screens); "Change cover" on the cover; the icon opens the
 * picker. A chosen image shows at once (local preview), is uploaded to Media and set on the note; if anything fails,
 * the previous image comes back and the picker shows why.
 */
export const EditableNoteHeader: React.FC<Props> = ({ getTitle, header: initialHeader, noteId }) => {
    const [header, setHeader] = useState<NoteHeaderData>(initialHeader)
    const [picker, setPicker] = useState<null | PickerState>(null)
    const [busy, setBusy] = useState<HeaderImageField | null>(null)
    const [error, setError] = useState<null | string>(null)
    const previewUrl = useRef<null | string>(null)

    const revokePreview = () => {
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
        previewUrl.current = null
    }
    useEffect(() => revokePreview, [])

    const openPicker = (field: HeaderImageField, trigger: HTMLElement | null) => {
        setError(null)
        setPicker({ field, trigger })
    }
    const closePicker = useCallback(() => setPicker(null), [])

    const onFile = async (field: HeaderImageField, file: File) => {
        const previous = header[field]
        revokePreview()
        previewUrl.current = URL.createObjectURL(file)
        const preview: NoteHeaderImage = { alt: '', height: null, url: previewUrl.current, width: null }
        setHeader((current) => ({ ...current, [field]: preview }))
        setBusy(field)
        setError(null)
        try {
            const image = await uploadHeaderImage({ field, file, noteId, title: getTitle() })
            setHeader((current) => ({ ...current, [field]: image }))
            setPicker(null)
        } catch (failure) {
            setHeader((current) => ({ ...current, [field]: previous }))
            setError(failure instanceof Error && failure.message ? failure.message : "Couldn't upload this image.")
        } finally {
            setBusy(null)
            revokePreview()
        }
    }

    const { cover, coverPosition, icon } = header
    const pickerFor = (field: HeaderImageField) =>
        picker?.field === field ? (
            <ImagePicker
                busy={busy === field}
                error={error}
                field={field}
                onClose={closePicker}
                onFile={(file) => void onFile(field, file)}
                trigger={picker.trigger}
            />
        ) : null

    return (
        <header
            className={cx(
                'note-header',
                'note-header--editable',
                cover && 'note-header--has-cover',
                icon && 'note-header--has-icon',
                busy && 'note-header--busy',
            )}
            data-testid="note-header"
        >
            {cover ? (
                <div className="note-header__cover" data-testid="note-cover">
                    {/* eslint-disable-next-line @next/next/no-img-element -- media is served by Payload (local disk / R2), not next/image */}
                    <img
                        alt=""
                        className="note-header__cover-image"
                        decoding="async"
                        height={cover.height ?? undefined}
                        src={cover.url}
                        style={{ objectPosition: `center ${coverPosition}%` }}
                        width={cover.width ?? undefined}
                    />
                    <div className="note-header__cover-actions">
                        <button
                            className="note-header__control"
                            data-testid="change-cover"
                            disabled={busy !== null}
                            onClick={(event) => openPicker('cover', event.currentTarget)}
                            type="button"
                        >
                            Change cover
                        </button>
                    </div>
                </div>
            ) : null}
            <div className="note-header__body">
                {icon ? (
                    <button
                        aria-label="Change icon"
                        className="note-header__icon note-header__icon-button"
                        data-testid="note-icon"
                        disabled={busy !== null}
                        onClick={(event) => openPicker('icon', event.currentTarget)}
                        type="button"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element -- media is served by Payload (local disk / R2), not next/image */}
                        <img
                            alt={icon.alt}
                            className="note-header__icon-image"
                            decoding="async"
                            height={icon.height ?? undefined}
                            src={icon.url}
                            width={icon.width ?? undefined}
                        />
                    </button>
                ) : null}
                {!icon || !cover ? (
                    <div className="note-header__add" data-testid="note-header-add">
                        {!icon ? (
                            <button
                                className="note-header__control"
                                data-testid="add-icon"
                                disabled={busy !== null}
                                onClick={(event) => openPicker('icon', event.currentTarget)}
                                type="button"
                            >
                                Add icon
                            </button>
                        ) : null}
                        {!cover ? (
                            <button
                                className="note-header__control"
                                data-testid="add-cover"
                                disabled={busy !== null}
                                onClick={(event) => openPicker('cover', event.currentTarget)}
                                type="button"
                            >
                                Add cover
                            </button>
                        ) : null}
                    </div>
                ) : null}
                {pickerFor('icon')}
                {pickerFor('cover')}
            </div>
        </header>
    )
}
