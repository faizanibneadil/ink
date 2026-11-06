import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useNoteAutosave } from '@/views/note-autosave/useNoteAutosave'

const originalFetch = globalThis.fetch

const mockFetch = () => {
  const bodies: unknown[] = []
  globalThis.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)))
    return new Response('{}', { status: 200 })
  }) as unknown as typeof fetch
  return bodies
}

describe('useNoteAutosave', () => {
  afterEach(() => {
    // Unmount every hook (removes its page listeners) before the next test
    cleanup()
    globalThis.fetch = originalFetch
    vi.useRealTimers()
  })

  it('on page hide, saves what the editor has now, not the older value Payload handed over', async () => {
    const bodies = mockFetch()
    let editorNow = 'typed and the last letters'
    const { result } = renderHook(() => useNoteAutosave<string>(101, 'saved', { readLatest: () => editorNow }))
    act(() => result.current.onChange('typed and the'))
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'))
      await Promise.resolve()
    })
    expect(bodies).toEqual([{ note: 'typed and the last letters' }])
    editorNow = 'unused'
  })

  it('on page hide with nothing new, sends nothing', async () => {
    const bodies = mockFetch()
    renderHook(() => useNoteAutosave<string>(102, 'saved', { readLatest: () => 'saved' }))
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'))
      await Promise.resolve()
    })
    expect(bodies).toEqual([])
  })

  it('beforeunload asks only while something is not saved', async () => {
    mockFetch()
    let editorNow = 'saved'
    const { result } = renderHook(() => useNoteAutosave<string>(103, 'saved', { readLatest: () => editorNow }))
    const ask = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(ask()).toBe(false)
    editorNow = 'changed'
    act(() => result.current.onChange('changed'))
    // Saving starts, and the page asks while it runs
    expect(ask()).toBe(true)
  })

  it('a re-mount (React Strict Mode) still saves', async () => {
    vi.useFakeTimers()
    const bodies = mockFetch()
    const { result, rerender, unmount } = renderHook(() => useNoteAutosave<string>(104, 'v0'), { reactStrictMode: true })
    rerender()
    act(() => result.current.onChange('v1'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(bodies).toEqual([{ note: 'v1' }])
    unmount()
  })
})
