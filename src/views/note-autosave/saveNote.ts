/** Largest request body the browser accepts with `keepalive` (64 KiB, shared by all keepalive requests). */
const KEEPALIVE_LIMIT = 60 * 1024

/** A failed note save, with a message for the save status. */
export class NoteSaveError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message)
        this.name = 'NoteSaveError'
    }
}

const messageFor = async (response: Response): Promise<string> => {
    if (response.status === 401 || response.status === 403) {
        return 'You are signed out. Sign in again to save.'
    }
    try {
        const body = (await response.json()) as { errors?: { message?: string }[] }
        const message = body.errors?.[0]?.message
        if (message) return message
    } catch {
        // Not JSON
    }
    return "Couldn't save"
}

/**
 * Saves the note's content through Payload's REST API (`PATCH /api/notes/:id`, logged-in cookie).
 * Only `note` is sent: the slug (the page URL), cover and icon are not touched.
 */
export const saveNoteContent = async (
    id: number | string,
    note: unknown,
    { keepalive = false }: { keepalive?: boolean } = {},
): Promise<void> => {
    const body = JSON.stringify({ note })
    let response: Response
    try {
        response = await fetch(`/api/notes/${encodeURIComponent(String(id))}?depth=0`, {
            body,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            // A bigger body would make a keepalive request fail at once; then it is a normal request
            keepalive: keepalive && body.length < KEEPALIVE_LIMIT,
            method: 'PATCH',
        })
    } catch {
        throw new NoteSaveError("Couldn't save. Check your connection.", 0)
    }
    if (!response.ok) {
        throw new NoteSaveError(await messageFor(response), response.status)
    }
}
