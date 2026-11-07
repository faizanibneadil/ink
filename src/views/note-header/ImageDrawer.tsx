'use client'

import { Drawer, Dropzone } from '@payloadcms/ui'
import { useId, useRef, useState } from 'react'

import type { Media } from '@/payload-types'

import { ACCEPTED_IMAGE_TYPES, type HeaderImageField, validateImageFile } from './header-images'
import { MediaLibrary } from './MediaLibrary'

type Props = {
    /** An upload / pick is running: the controls are disabled */
    busy: boolean
    /** Why the last upload / pick failed (from EditableNoteHeader) */
    error: null | string
    field: HeaderImageField
    onFile: (file: File) => void
    /** An image from the Media library was chosen */
    onPick: (media: Media) => void
    /** Drawer slug from `useDrawerSlug`; opened / closed with `useModal()` by EditableNoteHeader */
    slug: string
}

const HINTS: Record<HeaderImageField, string> = {
    cover: 'Images wider than 1500 pixels work best.',
    icon: 'Recommended size is 280 × 280 pixels.',
}

/**
 * Right-side drawer to change the cover / icon, built on Payload's own `Drawer` (the one its upload and relationship
 * drawers use): Payload's header with a close button, focus trap, Esc and a click on the backdrop close it, and focus
 * goes back to the button that opened it.
 *
 * Top: Payload's `Dropzone` (drop or paste an image, or "Select a file"). Below: the images uploaded before; picking
 * one sets it. EditableNoteHeader closes the drawer once the image is set.
 */
export const ImageDrawer: React.FC<Props> = ({ busy, error, field, onFile, onPick, slug }) => {
    const title = field === 'cover' ? 'Change cover' : 'Change icon'
    return (
        <Drawer className="note-image-drawer" slug={slug} title={title}>
            {/* Mounted only while the drawer is open (Payload's Drawer renders nothing when closed): every opening
                starts without an old error and loads the newest images */}
            <ImageDrawerBody busy={busy} error={error} field={field} onFile={onFile} onPick={onPick} />
        </Drawer>
    )
}

const ImageDrawerBody: React.FC<Omit<Props, 'slug'>> = ({ busy, error, field, onFile, onPick }) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [localError, setLocalError] = useState<null | string>(null)
    const errorId = useId()
    const libraryHeadingId = useId()
    const shownError = localError ?? error

    const takeFile = (file: File | undefined) => {
        if (!file || busy) return
        const problem = validateImageFile(file)
        setLocalError(problem)
        if (!problem) onFile(file)
    }

    return (
        <div aria-busy={busy} className={`note-image-drawer__body note-image-drawer__body--${field}`} data-testid="note-image-drawer">
            <section aria-label="Upload an image" className="note-image-drawer__upload">
                <Dropzone
                    className="note-image-drawer__dropzone"
                    disabled={busy}
                    hasError={Boolean(shownError)}
                    onChange={(files) => takeFile(files[0])}
                >
                    <div className="note-image-drawer__dropzone-content" data-testid="note-image-dropzone">
                        <button
                            aria-describedby={shownError ? errorId : undefined}
                            className="note-image-drawer__button note-image-drawer__button--primary"
                            disabled={busy}
                            onClick={() => inputRef.current?.click()}
                            type="button"
                        >
                            {busy ? 'Uploading…' : 'Select a file'}
                        </button>
                        <p className="note-image-drawer__drop-text">or drop / paste an image here</p>
                        <p className="note-image-drawer__hint">
                            {HINTS[field]} PNG, JPEG, GIF, WebP or AVIF, up to 10 MB.
                        </p>
                    </div>
                </Dropzone>
                <input
                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                    aria-label={field === 'cover' ? 'Cover image file' : 'Icon image file'}
                    className="note-image-drawer__input"
                    disabled={busy}
                    onChange={(event) => {
                        takeFile(event.target.files?.[0])
                        // Choosing the same file again must fire `change` again
                        event.target.value = ''
                    }}
                    ref={inputRef}
                    tabIndex={-1}
                    type="file"
                />
                {shownError ? (
                    <p className="note-image-drawer__error" id={errorId} role="alert">
                        {shownError}
                    </p>
                ) : null}
            </section>
            <section aria-labelledby={libraryHeadingId} className="note-image-drawer__library">
                <h3 className="note-image-drawer__section-title" id={libraryHeadingId}>
                    Uploaded images
                </h3>
                <MediaLibrary busy={busy} onPick={onPick} />
            </section>
        </div>
    )
}
