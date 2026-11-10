'use client'

import { useSyncExternalStore } from 'react'

export type DocumentTheme = 'dark' | 'light'

const read = (): DocumentTheme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'], attributes: true })
  return () => observer.disconnect()
}

/**
 * The page's theme: `<html data-theme>`, which both root layouts set (Payload's RootLayout and the guest website's,
 * src/app/(site)/layout.tsx) and Payload's theme switcher updates. Unlike `useTheme` from `@payloadcms/ui` it needs no
 * Payload provider, so read-only views can use it without the admin's client code.
 */
export const useDocumentTheme = (): DocumentTheme => useSyncExternalStore(subscribe, read, () => 'light')
