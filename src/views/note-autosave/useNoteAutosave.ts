'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { type AutosaveSnapshot, Autosaver } from './autosaver'
import { saveNoteContent } from './saveNote'

/**
 * Autosave for the note page editor: call `onChange` with every new editor value.
 * Saves are debounced (./autosaver.ts); pending changes are saved when the page is hidden or closed, and the browser
 * asks before leaving while a change is not saved yet.
 *
 * The autosaver is made in the effect (not during render), so each mount gets a live one: React may unmount and mount
 * an effect again (Strict Mode, fast refresh), and the cleanup disposes the old autosaver.
 */
export const useNoteAutosave = <T>(
    id: number | string,
    initialValue: T,
    {
        readLatest,
    }: {
        /**
         * Reads the editor's current value directly. Payload hands editor changes to `onChange` in idle time (up to
         * ~500 ms later), so without this the last letters typed just before the page is hidden / closed would be lost.
         */
        readLatest?: () => T | undefined
    } = {},
) => {
    const readLatestRef = useRef(readLatest)
    useLayoutEffect(() => {
        readLatestRef.current = readLatest
    }, [readLatest])
    const [snapshot, setSnapshot] = useState<AutosaveSnapshot>({ error: null, status: 'idle' })
    const autosaverRef = useRef<Autosaver<T> | null>(null)
    // Last value from the editor, so a re-mounted autosaver starts from what the user sees, not from the page load
    const latestRef = useRef<{ value: T } | null>(null)
    const savedRef = useRef<T>(initialValue)

    useEffect(() => {
        const autosaver = new Autosaver<T>({
            initialValue: savedRef.current,
            onChange: setSnapshot,
            save: async (value, { json, keepalive }) => {
                await saveNoteContent(id, value, { json, keepalive })
                savedRef.current = value
            },
        })
        autosaverRef.current = autosaver
        if (latestRef.current) autosaver.update(latestRef.current.value)

        /** Takes the editor's value as it is right now, then saves it at once. */
        const saveNow = () => {
            try {
                const current = readLatestRef.current?.()
                if (current !== undefined) {
                    latestRef.current = { value: current }
                    autosaver.update(current)
                }
            } catch {
                // Editor already gone: save the last value it handed over
            }
            autosaver.flush()
        }
        const onHidden = () => {
            if (document.visibilityState === 'hidden') saveNow()
        }
        const onPageHide = () => saveNow()
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            saveNow()
            if (!autosaver.hasUnsavedChanges()) return
            event.preventDefault()
            // Older browsers need returnValue to show the "Leave site?" dialog
            event.returnValue = ''
        }
        document.addEventListener('visibilitychange', onHidden)
        window.addEventListener('pagehide', onPageHide)
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => {
            document.removeEventListener('visibilitychange', onHidden)
            window.removeEventListener('pagehide', onPageHide)
            window.removeEventListener('beforeunload', onBeforeUnload)
            // Leaving the page inside the app (client navigation): save what is left
            saveNow()
            autosaver.dispose()
            if (autosaverRef.current === autosaver) autosaverRef.current = null
        }
    }, [id])

    const onChange = useCallback((value: T) => {
        latestRef.current = { value }
        autosaverRef.current?.update(value)
    }, [])
    const retry = useCallback(() => autosaverRef.current?.retry(), [])

    return { onChange, retry, snapshot }
}
