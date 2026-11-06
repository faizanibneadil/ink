'use client'

import { useEffect, useId, useRef, useState } from 'react'

import type { Media } from '@/payload-types'

import { ACCEPTED_IMAGE_TYPES, type HeaderImageField, validateImageFile } from './header-images'
import { MediaLibrary } from './MediaLibrary'

type Props = {
  /** Shown while an upload runs: the picker stays open and its controls are disabled */
  busy: boolean
  error: null | string
  field: HeaderImageField
  onClose: () => void
  onFile: (file: File) => void
  /** An image from the Media library was chosen */
  onPick: (media: Media) => void
  /** Element that opened the picker: focus goes back to it on close; clicks on it do not count as "outside" */
  trigger: HTMLElement | null
}

const HINTS: Record<HeaderImageField, string> = {
  cover: 'Images wider than 1500 pixels work best.',
  icon: 'Recommended size is 280 × 280 pixels.',
}

type Tab = 'library' | 'upload'
const TABS: { id: Tab; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'library', label: 'Media library' },
]

/**
 * Notion-style popover to change the cover / icon. Tabs: Upload, Media library (images uploaded before).
 * Esc or a click outside closes it; focus returns to the button that opened it.
 */
export const ImagePicker: React.FC<Props> = ({
  busy,
  error,
  field,
  onClose,
  onFile,
  onPick,
  trigger,
}) => {
  const [tab, setTab] = useState<Tab>('upload')
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})
  const panelId = useId()
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
      <span className="note-image-picker__title" id={titleId}>
        {field === 'cover' ? 'Change cover' : 'Change icon'}
      </span>
      <div
        aria-label={field === 'cover' ? 'Cover image source' : 'Icon image source'}
        className="note-image-picker__tabs"
        onKeyDown={(event) => {
          // Arrow keys move between the tabs (WAI-ARIA tabs pattern)
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const index = TABS.findIndex((item) => item.id === tab)
          const next =
            TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id
          setTab(next)
          tabRefs.current[next]?.focus()
        }}
        role="tablist"
      >
        {TABS.map((item) => (
          <button
            aria-controls={panelId}
            aria-selected={tab === item.id}
            className={`note-image-picker__tab${tab === item.id ? ' note-image-picker__tab--active' : ''}`}
            key={item.id}
            onClick={() => setTab(item.id)}
            ref={(element) => {
              tabRefs.current[item.id] = element
            }}
            role="tab"
            tabIndex={tab === item.id ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div aria-label={tab === 'upload' ? 'Upload' : 'Media library'} id={panelId} role="tabpanel">
        {tab === 'library' ? (
          <MediaLibrary busy={busy} onPick={onPick} />
        ) : (
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
            <p className="note-image-picker__hint">
              {HINTS[field]} You can also drop an image here.
            </p>
          </div>
        )}
      </div>
      {shownError ? (
        <p className="note-image-picker__error" id={errorId} role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  )
}
