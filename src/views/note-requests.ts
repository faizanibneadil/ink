/**
 * Runs the note page's write requests for one note one after another (autosave of the content, cover / icon changes).
 *
 * Two PATCH requests for the same note at the same time are not safe: on local SQLite the second one fails with
 * SQLITE_BUSY, and on D1 (no transactions) a slower request can write back the old value of a field the other request
 * just changed. Queuing them in the page avoids both.
 */
const queues = new Map<string, Promise<unknown>>()

export const runNoteRequest = <T>(id: number | string, request: () => Promise<T>): Promise<T> => {
    const key = String(id)
    const previous = queues.get(key) ?? Promise.resolve()
    // Runs after the previous request, whether it worked or not
    const next = previous.then(request, request)
    const settled = next.then(
        () => undefined,
        () => undefined,
    )
    queues.set(key, settled)
    void settled.then(() => {
        if (queues.get(key) === settled) queues.delete(key)
    })
    return next
}
