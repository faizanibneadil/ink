'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { Media } from '@/payload-types'

import { type LibraryPage, listLibraryImages } from './header-images'

type Props = {
    busy: boolean
    onPick: (media: Media) => void
}

type State =
    | { error: string; status: 'error' }
    | { status: 'loading' }
    | { docs: Media[]; hasNextPage: boolean; loadingMore: boolean; moreError: null | string; page: number; status: 'ready' }

/** The picker's "Media library" tab: images already uploaded, newest first, as a grid. Picking one sets it. */
export const MediaLibrary: React.FC<Props> = ({ busy, onPick }) => {
    const [state, setState] = useState<State>({ status: 'loading' })
    const alive = useRef(true)

    const load = useCallback(async () => {
        setState({ status: 'loading' })
        try {
            const first: LibraryPage = await listLibraryImages(1)
            if (alive.current) setState({ ...first, loadingMore: false, moreError: null, status: 'ready' })
        } catch (error) {
            if (alive.current) {
                setState({ error: error instanceof Error ? error.message : "Couldn't load the images.", status: 'error' })
            }
        }
    }, [])

    useEffect(() => {
        alive.current = true
        void load()
        return () => {
            alive.current = false
        }
    }, [load])

    const loadMore = async () => {
        if (state.status !== 'ready' || state.loadingMore) return
        setState({ ...state, loadingMore: true, moreError: null })
        try {
            const next = await listLibraryImages(state.page + 1)
            if (!alive.current) return
            setState((current) => {
                if (current.status !== 'ready') return current
                const seen = new Set(current.docs.map((doc) => doc.id))
                return {
                    docs: [...current.docs, ...next.docs.filter((doc) => !seen.has(doc.id))],
                    hasNextPage: next.hasNextPage,
                    loadingMore: false,
                    moreError: null,
                    page: next.page,
                    status: 'ready',
                }
            })
        } catch (error) {
            if (!alive.current) return
            setState((current) =>
                current.status === 'ready'
                    ? { ...current, loadingMore: false, moreError: error instanceof Error ? error.message : "Couldn't load more." }
                    : current,
            )
        }
    }

    if (state.status === 'loading') {
        return (
            <p className="note-media-library__message" data-testid="media-library-loading" role="status">
                Loading images…
            </p>
        )
    }
    if (state.status === 'error') {
        return (
            <div className="note-media-library__message" data-testid="media-library-error" role="alert">
                <p>{state.error}</p>
                <button className="note-image-picker__upload" onClick={() => void load()} type="button">
                    Try again
                </button>
            </div>
        )
    }
    if (state.docs.length === 0) {
        return (
            <p className="note-media-library__message" data-testid="media-library-empty">
                No images yet. Upload one in the Upload tab.
            </p>
        )
    }
    return (
        <div className="note-media-library">
            <ul className="note-media-library__grid" data-testid="media-library-grid">
                {state.docs.map((media) =>
                    media.url ? (
                        <li key={media.id}>
                            <button
                                aria-label={media.alt || media.filename || `Image ${media.id}`}
                                className="note-media-library__item"
                                data-media-id={media.id}
                                disabled={busy}
                                onClick={() => onPick(media)}
                                title={media.alt || media.filename || undefined}
                                type="button"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element -- media is served by Payload (local disk / R2), not next/image */}
                                <img alt="" decoding="async" loading="lazy" src={media.url} />
                            </button>
                        </li>
                    ) : null,
                )}
            </ul>
            {state.hasNextPage || state.moreError ? (
                <div className="note-media-library__more">
                    {state.moreError ? (
                        <p className="note-image-picker__error" role="alert">
                            {state.moreError}
                        </p>
                    ) : null}
                    <button
                        className="note-image-picker__upload"
                        disabled={state.loadingMore}
                        onClick={() => void loadMore()}
                        type="button"
                    >
                        {state.loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                </div>
            ) : null}
        </div>
    )
}
