/**
 * Autosave of the note page editor (Notion-style), without React so it can be tested on its own.
 *
 * - Debounced: saves `delay` ms after the last change, but at least every `maxWait` ms while the user keeps typing.
 * - One request at a time: a change made while a save is running is saved right after it, so an older save can never
 *   overwrite a newer one on the server.
 * - Nothing is sent when the value is the same as the last saved one (or as the value the page was opened with).
 * - Cheap per change: `update()` only keeps the value and marks it dirty. The value is serialized once, when a save
 *   runs, and the saver gets that string (`json`) so it does not have to serialize it again.
 * - A failed save keeps the changes as unsaved: `retry()` (or the next change) tries again.
 * - `flush()` saves now (page hidden / closed), using `keepalive` so the browser can finish it after the page is gone.
 */

export type AutosaveStatus = 'error' | 'idle' | 'pending' | 'saved' | 'saving'

export type AutosaveSnapshot = {
    /** Message of the last failed save, when `status` is `error` */
    error: null | string
    status: AutosaveStatus
}

export type SaveFunction<T> = (
    value: T,
    options: {
        /** `value` already serialized (with `serialize`): send this instead of serializing it again */
        json: string
        keepalive: boolean
    },
) => Promise<void>

export type AutosaverOptions<T> = {
    /** Wait this long after the last change before saving (ms) */
    delay?: number
    /** The value the page was opened with (counts as saved) */
    initialValue: T
    /** Save at least this often while changes keep coming (ms) */
    maxWait?: number
    onChange?: (snapshot: AutosaveSnapshot) => void
    save: SaveFunction<T>
    serialize?: (value: T) => string
}

export const AUTOSAVE_DELAY = 1000
export const AUTOSAVE_MAX_WAIT = 5000

const errorMessage = (error: unknown): string =>
    error instanceof Error && error.message ? error.message : "Couldn't save"

export class Autosaver<T> {
    private delay: number
    /** `latest` changed since it was last serialized for a save (not known to be saved) */
    private dirty = false
    private disposed = false
    private firstChangeAt: null | number = null
    private flushRequested = false
    private inFlight = false
    private latest: T
    private maxWait: number
    private onChangeListener?: (snapshot: AutosaveSnapshot) => void
    private save: SaveFunction<T>
    private savedKey: string
    private serialize: (value: T) => string
    private snapshot: AutosaveSnapshot = { error: null, status: 'idle' }
    private timer: null | ReturnType<typeof setTimeout> = null

    constructor(options: AutosaverOptions<T>) {
        this.delay = options.delay ?? AUTOSAVE_DELAY
        this.maxWait = Math.max(options.maxWait ?? AUTOSAVE_MAX_WAIT, this.delay)
        this.save = options.save
        this.serialize = options.serialize ?? ((value) => JSON.stringify(value))
        this.onChangeListener = options.onChange
        this.latest = options.initialValue
        this.savedKey = this.serialize(options.initialValue)
    }

    get state(): AutosaveSnapshot {
        return this.snapshot
    }

    /** Changes not saved yet (or being saved): leaving the page now could lose them. */
    hasUnsavedChanges(): boolean {
        return this.inFlight || this.dirty
    }

    /** New editor value. Cheap: no serialization here (it runs once, when the save runs). */
    update(value: T): void {
        if (this.disposed) return
        this.latest = value
        this.dirty = true
        this.schedule()
    }

    /** Save now (page hidden / closing). */
    flush(): void {
        if (this.disposed) return
        if (this.inFlight) {
            this.flushRequested = true
            return
        }
        void this.run(true)
    }

    /** Try a failed save again. */
    retry(): void {
        if (this.disposed) return
        void this.run(false)
    }

    dispose(): void {
        this.disposed = true
        this.clearTimer()
    }

    private clearTimer() {
        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }

    private schedule() {
        const now = Date.now()
        this.firstChangeAt ??= now
        const wait = Math.max(0, Math.min(this.delay, this.firstChangeAt + this.maxWait - now))
        this.clearTimer()
        this.timer = setTimeout(() => {
            this.timer = null
            void this.run(false)
        }, wait)
        if (this.snapshot.status !== 'saving') {
            this.setSnapshot({ error: null, status: 'pending' })
        }
    }

    private async run(keepalive: boolean): Promise<void> {
        this.clearTimer()
        // A save is already running: this change is saved when it is done
        if (this.inFlight) return
        this.firstChangeAt = null
        if (!this.dirty) {
            if (this.snapshot.status !== 'idle') this.setSnapshot({ error: null, status: 'saved' })
            return
        }

        // The only serialization of this value
        const value = this.latest
        const json = this.serialize(value)
        this.dirty = false
        if (json === this.savedKey) {
            // Back to what is saved (e.g. typed and deleted a letter): nothing to send
            this.setSnapshot({ error: null, status: 'saved' })
            return
        }

        this.inFlight = true
        this.setSnapshot({ error: null, status: 'saving' })
        try {
            await this.save(value, { json, keepalive })
        } catch (error) {
            this.inFlight = false
            this.flushRequested = false
            // Not saved: still to be saved (retry() or the next change)
            this.dirty = true
            if (!this.disposed) this.setSnapshot({ error: errorMessage(error), status: 'error' })
            return
        }
        this.inFlight = false
        this.savedKey = json
        if (this.disposed) return

        if (this.dirty) {
            // Changed while saving: save the newer value next
            if (this.flushRequested) {
                this.flushRequested = false
                void this.run(true)
            } else {
                this.schedule()
            }
            return
        }
        this.flushRequested = false
        this.setSnapshot({ error: null, status: 'saved' })
    }

    private setSnapshot(snapshot: AutosaveSnapshot) {
        this.snapshot = snapshot
        this.onChangeListener?.(snapshot)
    }
}
