import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type AutosaveSnapshot, Autosaver } from '@/views/note-autosave/autosaver'
import { NoteSaveError, saveNoteContent } from '@/views/note-autosave/saveNote'

type Call = { json: string; keepalive: boolean; resolve: () => void; reject: (error: Error) => void; value: string }

/** A save function whose requests the test finishes by hand. */
const controlledSave = () => {
  const calls: Call[] = []
  const save = vi.fn(
    (value: string, { json, keepalive }: { json: string; keepalive: boolean }) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ json, keepalive, reject, resolve, value })
      }),
  )
  return { calls, save }
}

const setup = (initialValue = 'v0') => {
  const { calls, save } = controlledSave()
  const states: AutosaveSnapshot[] = []
  // Counts serializations (the costly part on a large note)
  const serialize = vi.fn((value: string) => JSON.stringify(value))
  const autosaver = new Autosaver<string>({
    delay: 1000,
    initialValue,
    maxWait: 5000,
    onChange: (snapshot) => states.push(snapshot),
    save,
    serialize,
  })
  return { autosaver, calls, save, serialize, states }
}

/** Lets resolved save promises run their `then` code. */
const settle = () => vi.advanceTimersByTimeAsync(0)

describe('Autosaver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves nothing until something changes', async () => {
    const { autosaver, save } = setup()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(save).not.toHaveBeenCalled()
    expect(autosaver.state.status).toBe('idle')
    expect(autosaver.hasUnsavedChanges()).toBe(false)
  })

  it('a value equal to the saved one is not sent', async () => {
    const { autosaver, save } = setup('same')
    autosaver.update('same')
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).not.toHaveBeenCalled()
  })

  it('saves once, 1s after the last change, with the last value', async () => {
    const { autosaver, calls, save } = setup()
    autosaver.update('a')
    await vi.advanceTimersByTimeAsync(500)
    autosaver.update('ab')
    await vi.advanceTimersByTimeAsync(500)
    autosaver.update('abc')
    expect(autosaver.state.status).toBe('pending')
    await vi.advanceTimersByTimeAsync(999)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(calls[0].value).toBe('abc')
    expect(calls[0].keepalive).toBe(false)
    expect(autosaver.state.status).toBe('saving')
    calls[0].resolve()
    await settle()
    expect(autosaver.state.status).toBe('saved')
    expect(autosaver.hasUnsavedChanges()).toBe(false)
  })

  it('typing without a pause still saves every 5s (maxWait)', async () => {
    const { autosaver, calls } = setup()
    for (let i = 1; i <= 50; i++) {
      autosaver.update(`v${i}`)
      await vi.advanceTimersByTimeAsync(200)
    }
    // 50 changes over 10s, never 1s apart: at least one save by maxWait
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(calls[0].value).toBe('v25')
  })

  it('never runs two saves at once; a change made while saving is saved after it', async () => {
    const { autosaver, calls } = setup()
    autosaver.update('first')
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(1)

    autosaver.update('second')
    await vi.advanceTimersByTimeAsync(3000)
    // still only the first request: the second waits for it
    expect(calls).toHaveLength(1)
    expect(autosaver.hasUnsavedChanges()).toBe(true)

    calls[0].resolve()
    await settle()
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(2)
    expect(calls[1].value).toBe('second')
    calls[1].resolve()
    await settle()
    expect(autosaver.state.status).toBe('saved')
  })

  it('a failed save shows the error, keeps the change unsaved, and retry() sends the latest value', async () => {
    const { autosaver, calls } = setup()
    autosaver.update('draft')
    await vi.advanceTimersByTimeAsync(1000)
    calls[0].reject(new NoteSaveError('Server error', 500))
    await settle()
    expect(autosaver.state).toEqual({ error: 'Server error', status: 'error' })
    expect(autosaver.hasUnsavedChanges()).toBe(true)

    // No automatic loop of retries
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(1)

    autosaver.update('draft 2')
    autosaver.retry()
    expect(calls).toHaveLength(2)
    expect(calls[1].value).toBe('draft 2')
    calls[1].resolve()
    await settle()
    expect(autosaver.state.status).toBe('saved')
    expect(autosaver.hasUnsavedChanges()).toBe(false)
  })

  it('the next change after an error tries again on its own', async () => {
    const { autosaver, calls } = setup()
    autosaver.update('x')
    await vi.advanceTimersByTimeAsync(1000)
    calls[0].reject(new Error('offline'))
    await settle()
    autosaver.update('xy')
    expect(autosaver.state.status).toBe('pending')
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(2)
    expect(calls[1].value).toBe('xy')
  })

  it('flush() saves at once with keepalive (page hidden / closed)', async () => {
    const { autosaver, calls } = setup()
    autosaver.update('leaving')
    autosaver.flush()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ keepalive: true, value: 'leaving' })
    // The debounced save does not send it a second time
    calls[0].resolve()
    await settle()
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls).toHaveLength(1)
  })

  it('flush() during a running save sends the newer value right after it, with keepalive', async () => {
    const { autosaver, calls } = setup()
    autosaver.update('a')
    await vi.advanceTimersByTimeAsync(1000)
    autosaver.update('ab')
    autosaver.flush()
    expect(calls).toHaveLength(1)
    calls[0].resolve()
    await settle()
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({ keepalive: true, value: 'ab' })
  })

  it('flush() with nothing to save sends nothing', async () => {
    const { autosaver, save } = setup()
    autosaver.flush()
    await settle()
    expect(save).not.toHaveBeenCalled()
  })

  it('typing a letter and deleting it again sends no save', async () => {
    const { autosaver, save } = setup('text')
    autosaver.update('text!')
    autosaver.update('text')
    // Not compared yet (that happens when the save runs), so it may count as unsaved until then
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).not.toHaveBeenCalled()
    expect(autosaver.state.status).toBe('saved')
    expect(autosaver.hasUnsavedChanges()).toBe(false)
  })

  it('serializes only when a save runs, once, and hands the string to the saver', async () => {
    const { autosaver, calls, serialize } = setup()
    // the constructor serializes the value the page was opened with, once
    expect(serialize).toHaveBeenCalledTimes(1)
    for (let i = 1; i <= 20; i++) autosaver.update(`v${i}`)
    expect(serialize).toHaveBeenCalledTimes(1)
    expect(autosaver.hasUnsavedChanges()).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(serialize).toHaveBeenCalledTimes(2)
    expect(serialize).toHaveBeenLastCalledWith('v20')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ json: '"v20"', value: 'v20' })
    calls[0].resolve()
    await settle()
    expect(serialize).toHaveBeenCalledTimes(2)
  })

  it('a failed save is retried with the latest value, serialized again', async () => {
    const { autosaver, calls } = setup()
    autosaver.update('a')
    await vi.advanceTimersByTimeAsync(1000)
    calls[0].reject(new Error('offline'))
    await settle()
    expect(autosaver.hasUnsavedChanges()).toBe(true)
    autosaver.retry()
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({ json: '"a"', value: 'a' })
  })

  it('going back to the opened value while a save runs still saves it after that save', async () => {
    const { autosaver, calls } = setup('v0')
    autosaver.update('a')
    await vi.advanceTimersByTimeAsync(1000)
    autosaver.update('v0')
    calls[0].resolve()
    await settle()
    await vi.advanceTimersByTimeAsync(1000)
    // The server now has 'a', so 'v0' is a real change again
    expect(calls).toHaveLength(2)
    expect(calls[1].value).toBe('v0')
  })

  it('after dispose() no new save starts, but a started save still finishes', async () => {
    const { autosaver, calls } = setup()
    autosaver.update('last words')
    autosaver.flush()
    autosaver.dispose()
    expect(calls).toHaveLength(1)
    calls[0].resolve()
    await settle()
    autosaver.update('after dispose')
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls).toHaveLength(1)
  })
})

describe('saveNoteContent', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('PATCHes only `note` to the REST API with the login cookie', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await saveNoteContent(7, { root: { children: [] } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/notes/7?depth=0')
    expect(init.method).toBe('PATCH')
    expect(init.credentials).toBe('include')
    expect(JSON.parse(init.body as string)).toEqual({ note: { root: { children: [] } } })
    expect(init.keepalive).toBe(false)
  })

  it('builds the body around the already-serialized note instead of serializing it again', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const note = { root: { children: [{ text: 'a "quoted" \\ text' }] } }
    const stringify = vi.spyOn(JSON, 'stringify')
    await saveNoteContent(7, note, { json: '{"root":{"children":[{"text":"a \\"quoted\\" \\\\ text"}]}}' })
    expect(stringify).not.toHaveBeenCalled()
    stringify.mockRestore()
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.body).toBe('{"note":{"root":{"children":[{"text":"a \\"quoted\\" \\\\ text"}]}}}')
    expect(JSON.parse(init.body as string)).toEqual({ note })
  })

  it('without `json` (or with no value at all) it serializes the note itself', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await saveNoteContent(7, null, { json: 'null' })
    await saveNoteContent(7, undefined, { json: JSON.stringify(undefined) })
    await saveNoteContent(7, { a: 1 })
    const bodies = (fetchMock.mock.calls as unknown as [string, RequestInit][]).map(([, init]) => init.body)
    expect(bodies).toEqual(['{"note":null}', '{}', '{"note":{"a":1}}'])
  })

  it('keepalive only when the body fits the browser limit', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await saveNoteContent(1, { text: 'small' }, { keepalive: true })
    await saveNoteContent(1, { text: 'x'.repeat(70 * 1024) }, { keepalive: true })
    // Same check when the body is built from pre-serialized JSON (on the whole body, wrapper included)
    const big = JSON.stringify({ text: 'x'.repeat(60 * 1024 - 15) })
    await saveNoteContent(1, null, { json: big, keepalive: true })
    await saveNoteContent(1, null, { json: JSON.stringify({ text: 'small' }), keepalive: true })
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(calls[0][1].keepalive).toBe(true)
    expect(calls[1][1].keepalive).toBe(false)
    expect(big.length).toBeLessThan(60 * 1024)
    expect((calls[2][1].body as string).length).toBeGreaterThanOrEqual(60 * 1024)
    expect(calls[2][1].keepalive).toBe(false)
    expect(calls[3][1].keepalive).toBe(true)
  })

  it('turns failures into readable messages', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 403 })) as unknown as typeof fetch
    await expect(saveNoteContent(1, {})).rejects.toMatchObject({ message: 'You are signed out. Sign in again to save.', status: 403 })

    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ errors: [{ message: 'The following field is invalid: note' }] }), { status: 400 }),
    ) as unknown as typeof fetch
    await expect(saveNoteContent(1, {})).rejects.toMatchObject({ message: 'The following field is invalid: note', status: 400 })

    globalThis.fetch = vi.fn(async () => new Response('<html>', { status: 502 })) as unknown as typeof fetch
    await expect(saveNoteContent(1, {})).rejects.toMatchObject({ message: "Couldn't save", status: 502 })

    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(saveNoteContent(1, {})).rejects.toMatchObject({ message: "Couldn't save. Check your connection.", status: 0 })
  })
})
