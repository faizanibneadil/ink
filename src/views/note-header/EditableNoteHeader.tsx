'use client'

import { useDrawerSlug, useModal } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'

import type { Media } from '@/payload-types'

import { type NoteHeaderData, type NoteHeaderImage, toHeaderImage } from './header-data'
import { coverOverflow, dragCoverPosition, stepCoverPosition } from './cover-position'
import { type HeaderImageField, setCoverPosition, setNoteImage, uploadHeaderImage } from './header-images'
import { ImageDrawer } from './ImageDrawer'

import './note-header.css'

type Props = {
    /** Current title of the note (first line of the content), used for the uploaded file's alt text */
    getTitle: () => string
    header: NoteHeaderData
    noteId: number | string
}

/** "Reposition" mode of the cover: the position being dragged and the one to go back to on Cancel. */
type RepositionState = { error: null | string; position: number; saving: boolean; start: number }

const cx = (...classes: (false | null | string | undefined)[]) => classes.filter(Boolean).join(' ')

/**
 * The note header in the editor: same layout as the read-only header (NoteHeader.tsx), plus Notion's controls.
 * "Add icon" / "Add cover" show on hover (always on touch screens); "Change cover" and "Reposition" on the cover; the
 * icon, "Add …" and "Change cover" open the image drawer (ImageDrawer.tsx, Payload's Drawer). A chosen image shows at
 * once (local preview), is uploaded to Media and set on the note, and the drawer closes; if anything fails, the
 * previous image comes back and the drawer shows why.
 */
export const EditableNoteHeader: React.FC<Props> = ({ getTitle, header: initialHeader, noteId }) => {
    const [header, setHeader] = useState<NoteHeaderData>(initialHeader)
    const drawerSlug = useDrawerSlug('note-image')
    const { closeModal, isModalOpen, openModal } = useModal()
    // Which image the drawer changes; kept after it closes, so the closing drawer does not switch titles
    const [field, setField] = useState<HeaderImageField>('cover')
    // Read in async code after `await`, where the render's `isModalOpen` would be stale
    const drawerOpen = useRef(false)
    drawerOpen.current = isModalOpen(drawerSlug)
    const [busy, setBusy] = useState<HeaderImageField | null>(null)
    const [error, setError] = useState<null | string>(null)
    const previewUrl = useRef<null | string>(null)
    const [reposition, setReposition] = useState<null | RepositionState>(null)
    const coverRef = useRef<HTMLDivElement>(null)
    const coverImageRef = useRef<HTMLImageElement>(null)
    const repositionButtonRef = useRef<HTMLButtonElement>(null)
    const drag = useRef<null | { overflow: number; pointerId: number; startPosition: number; startY: number }>(null)

    const revokePreview = () => {
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
        previewUrl.current = null
    }
    useEffect(() => revokePreview, [])

    const openDrawer = (next: HeaderImageField) => {
        setError(null)
        setField(next)
        openModal(drawerSlug)
    }

    /** The image is set: close the drawer (Payload gives focus back to the button that opened it). */
    const done = (changed: HeaderImageField) => {
        focusAfterSet.current = changed
        closeModal(drawerSlug)
    }

    // "Add cover" / "Add icon" are gone once the image is set, so Payload cannot give focus back to them: keyboard
    // users land on the new image's control instead ("Change cover" / the icon), not at the top of the page.
    const changeCoverRef = useRef<HTMLButtonElement>(null)
    const iconButtonRef = useRef<HTMLButtonElement>(null)
    const focusAfterSet = useRef<HeaderImageField | null>(null)
    const isDrawerOpen = isModalOpen(drawerSlug)
    useEffect(() => {
        if (isDrawerOpen || !focusAfterSet.current) return
        const changed = focusAfterSet.current
        focusAfterSet.current = null
        // After Payload's focus trap has given focus back (it runs when the drawer has closed)
        const timer = window.setTimeout(() => {
            const active = document.activeElement
            if (active && active !== document.body && active.isConnected) return
            ;(changed === 'cover' ? changeCoverRef : iconButtonRef).current?.focus()
        }, 50)
        return () => window.clearTimeout(timer)
    }, [isDrawerOpen])

    /** Failed: show why in the drawer, opening it again if it was closed while the upload ran. */
    const failed = (message: string) => {
        setError(message)
        if (!drawerOpen.current) openModal(drawerSlug)
    }

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
            done(field)
        } catch (failure) {
            setHeader((current) => ({ ...current, [field]: previous }))
            failed(failure instanceof Error && failure.message ? failure.message : "Couldn't upload this image.")
        } finally {
            setBusy(null)
            revokePreview()
        }
    }

    const onPick = async (field: HeaderImageField, media: Media) => {
        const chosen = toHeaderImage(media)
        if (!chosen) {
            setError("This file can't be used as an image.")
            return
        }
        const previous = header[field]
        setHeader((current) => ({ ...current, [field]: chosen }))
        setBusy(field)
        setError(null)
        try {
            const image = await setNoteImage(noteId, field, media.id)
            setHeader((current) => ({ ...current, [field]: image }))
            done(field)
        } catch (failure) {
            setHeader((current) => ({ ...current, [field]: previous }))
            failed(failure instanceof Error && failure.message ? failure.message : "Couldn't use this image.")
        } finally {
            setBusy(null)
        }
    }

    // ---------- Cover reposition ----------

    const startReposition = () => {
        closeModal(drawerSlug)
        setReposition({ error: null, position: header.coverPosition, saving: false, start: header.coverPosition })
    }

    // Keyboard users land on the cover (a slider) as soon as the mode starts, and back on "Reposition" when it ends
    const repositioning = reposition !== null
    const wasRepositioning = useRef(false)
    useEffect(() => {
        if (repositioning) {
            coverRef.current?.focus()
        } else if (wasRepositioning.current) {
            repositionButtonRef.current?.focus()
        }
        wasRepositioning.current = repositioning
    }, [repositioning])

    const finishReposition = () => {
        setReposition(null)
    }

    const cancelReposition = () => {
        if (!reposition || reposition.saving) return
        finishReposition()
    }

    const saveReposition = async () => {
        if (!reposition || reposition.saving) return
        if (reposition.position === reposition.start) {
            finishReposition()
            return
        }
        setReposition({ ...reposition, error: null, saving: true })
        try {
            const saved = await setCoverPosition(noteId, reposition.position)
            setHeader((current) => ({ ...current, coverPosition: saved }))
            finishReposition()
        } catch (failure) {
            setReposition((current) =>
                current
                    ? {
                          ...current,
                          error: failure instanceof Error && failure.message ? failure.message : "Couldn't save the position.",
                          saving: false,
                      }
                    : current,
            )
        }
    }

    const measureOverflow = () => {
        const box = coverRef.current
        const image = coverImageRef.current
        if (!box || !image) return 0
        return coverOverflow({
            boxHeight: box.clientHeight,
            boxWidth: box.clientWidth,
            imageHeight: image.naturalHeight,
            imageWidth: image.naturalWidth,
        })
    }

    const onCoverPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!reposition || reposition.saving || event.button !== 0) return
        // Only the image area drags, not the Save / Cancel buttons
        if ((event.target as HTMLElement).closest('button')) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = {
            overflow: measureOverflow(),
            pointerId: event.pointerId,
            startPosition: reposition.position,
            startY: event.clientY,
        }
    }

    const onCoverPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        const position = dragCoverPosition(current.startPosition, event.clientY - current.startY, current.overflow)
        setReposition((state) => (state ? { ...state, position } : state))
    }

    const onCoverPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null
    }

    const onCoverKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!reposition || event.target !== event.currentTarget) return
        if (event.key === 'Escape') {
            event.preventDefault()
            cancelReposition()
            return
        }
        if (event.key === 'Enter') {
            event.preventDefault()
            void saveReposition()
            return
        }
        const next = stepCoverPosition(reposition.position, event.key, event.shiftKey)
        if (next !== null && !reposition.saving) {
            event.preventDefault()
            setReposition({ ...reposition, position: next })
        }
    }

    const { cover, icon } = header
    const coverPosition = reposition ? reposition.position : header.coverPosition

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
                <div
                    aria-label={reposition ? 'Cover position. Drag the image or use the arrow keys, Enter to save, Escape to cancel.' : undefined}
                    aria-valuemax={reposition ? 100 : undefined}
                    aria-valuemin={reposition ? 0 : undefined}
                    aria-valuenow={reposition ? Math.round(reposition.position) : undefined}
                    aria-valuetext={reposition ? `${Math.round(reposition.position)}% from the top` : undefined}
                    className={cx('note-header__cover', reposition && 'note-header__cover--repositioning')}
                    data-testid="note-cover"
                    onKeyDown={reposition ? onCoverKeyDown : undefined}
                    onLostPointerCapture={onCoverPointerUp}
                    onPointerCancel={onCoverPointerUp}
                    onPointerDown={reposition ? onCoverPointerDown : undefined}
                    onPointerMove={reposition ? onCoverPointerMove : undefined}
                    onPointerUp={onCoverPointerUp}
                    ref={coverRef}
                    role={reposition ? 'slider' : undefined}
                    tabIndex={reposition ? 0 : undefined}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element -- media is served by Payload (local disk / R2), not next/image */}
                    <img
                        alt=""
                        className="note-header__cover-image"
                        decoding="async"
                        draggable={false}
                        height={cover.height ?? undefined}
                        ref={coverImageRef}
                        src={cover.url}
                        style={{ objectPosition: `center ${coverPosition}%` }}
                        width={cover.width ?? undefined}
                    />
                    {reposition ? (
                        <>
                            <p aria-hidden className="note-header__reposition-hint">
                                Drag image to reposition
                            </p>
                            <div className="note-header__cover-actions note-header__cover-actions--visible">
                                {reposition.error ? (
                                    <span className="note-header__reposition-error" role="alert">
                                        {reposition.error}
                                    </span>
                                ) : null}
                                <button
                                    className="note-header__control"
                                    data-testid="save-position"
                                    disabled={reposition.saving}
                                    onClick={() => void saveReposition()}
                                    type="button"
                                >
                                    {reposition.saving ? 'Saving…' : 'Save position'}
                                </button>
                                <button
                                    className="note-header__control"
                                    data-testid="cancel-position"
                                    disabled={reposition.saving}
                                    onClick={cancelReposition}
                                    type="button"
                                >
                                    Cancel
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="note-header__cover-actions">
                            <button
                                className="note-header__control"
                                data-testid="change-cover"
                                ref={changeCoverRef}
                                disabled={busy !== null}
                                onClick={() => openDrawer('cover')}
                                type="button"
                            >
                                Change cover
                            </button>
                            <button
                                className="note-header__control"
                                data-testid="reposition-cover"
                                disabled={busy !== null}
                                onClick={startReposition}
                                ref={repositionButtonRef}
                                type="button"
                            >
                                Reposition
                            </button>
                        </div>
                    )}
                </div>
            ) : null}
            <div className="note-header__body">
                {icon ? (
                    <button
                        aria-label="Change icon"
                        className="note-header__icon note-header__icon-button"
                        data-testid="note-icon"
                        ref={iconButtonRef}
                        disabled={busy !== null}
                        onClick={() => openDrawer('icon')}
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
                                onClick={() => openDrawer('icon')}
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
                                onClick={() => openDrawer('cover')}
                                type="button"
                            >
                                Add cover
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>
            <ImageDrawer
                busy={busy === field}
                error={error}
                field={field}
                onFile={(file) => void onFile(field, file)}
                onPick={(media) => void onPick(field, media)}
                slug={drawerSlug}
            />
        </header>
    )
}
