import type React from 'react'

/*
 * Shared by the Payload admin and the website (see ./page.tsx). Which one renders is decided in the page, so this
 * layout only passes the page through.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
