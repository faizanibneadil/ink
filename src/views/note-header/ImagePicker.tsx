'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { ACCEPTED_IMAGE_TYPES, type HeaderImageField, validateImageFile } from './header-images'

type Props = {
    /** Shown while an upload runs: the picker stays open and its controls are disabled */
    busy: boolean
    error: null | string
    field: HeaderImageField
    onClose: () => void
    onFile: (file: File) => void
    /** Element that opened the picker: focus goes back to it on close; clicks on it do not count as "outside" */
    trigger: HTMLElement | null
}

const HINTS: Record<HeaderImageField, string> = {
    cover: 'Images wider than 1500 pixels work best.',
    icon: 'Recommended size is 280 × 280 pixels.',
}

/**
 * Notion-style popover to change the cover / icon. Tabs: Upload (and, later, the Media library).
 * Esc or a click outside closes it; focus returns to the button that opened it.
 */
export const ImagePicker: React.FC<Props> = ({ busy, error, field, onClose, onFile, trigger }) => {
    const panelRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const uploadButtonRef = useRef<HTMLButtonElement>(null)
    const [localError, setLocalError] = useState<null | string>(null)
    const [dragging, setDragging] = useState(false)
    const titleId = useId()
    const errorId = useId()
    const shownError = localError ?? error

    // Focus the first control when it opens; give focus back to the trigger when it closes
    useEffect(() => {
        uploadButtonRef.current?.focus()
        return () => {
            trigger?.focus()
        }
    }, [trigger])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busy) {
                event.stopPropagation()
                onClose()
            }
        }
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node
            if (busy || panelRef.current?.contains(target) || trigger?.contains(target)) return
            onClose()
        }
        document.addEventListener('keydown', onKeyDown, true)
        document.addEventListener('pointerdown', onPointerDown, true)
        return () => {
            document.removeEventListener('keydown', onKeyDown, true)
            document.removeEventListener('pointerdown', onPointerDown, true)
        }
    }, [busy, onClose, trigger])

    const takeFile = (file: File | undefined) => {
        if (!file || busy) return
        const problem = validateImageFile(file)
        setLocalError(problem)
        if (!problem) onFile(file)
    }

    return (
        <div
            aria-busy={busy}
            aria-describedby={shownError ? errorId : undefined}
            aria-labelledby={titleId}
            className={`note-image-picker note-image-picker--${field}`}
            data-testid="note-image-picker"
            ref={panelRef}
            role="dialog"
        >
            <div className="note-image-picker__tabs" role="tablist">
                <span className="note-image-picker__tab note-image-picker__tab--active" id={titleId} role="tab" aria-selected>
                    Upload
                </span>
            </div>
            <div
                className={`note-image-picker__drop${dragging ? ' note-image-picker__drop--over' : ''}`}
                onDragLeave={() => setDragging(false)}
                onDragOver={(event) => {
                    event.preventDefault()
                    setDragging(true)
                }}
                onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    takeFile(event.dataTransfer.files[0])
                }}
            >
                <button
                    className="note-image-picker__upload"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                    ref={uploadButtonRef}
                    type="button"
                >
                    {busy ? 'Uploading…' : 'Upload file'}
                </button>
                <input
                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                    aria-label={field === 'cover' ? 'Cover image file' : 'Icon image file'}
                    className="note-image-picker__input"
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
                <p className="note-image-picker__hint">{HINTS[field]} You can also drop an image here.</p>
            </div>
            {shownError ? (
                <p className="note-image-picker__error" id={errorId} role="alert">
                    {shownError}
                </p>
            ) : null}
        </div>
    )
}
