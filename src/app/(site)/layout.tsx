/*
 * Root layout of the guest website (landing page, notes read by guests): src/proxy.ts rewrites guests here.
 *
 * Unlike Payload's RootLayout (src/app/(payload)/layout.tsx) it has no Payload client providers, so a guest does not
 * download the admin's JavaScript (docs/bundle/AUDIT.md). It keeps what the pages read from it: Payload's CSS
 * variables and fonts, and the same `data-theme` / `data-enhanced-contrast` a guest got from Payload's RootLayout.
 *
 * Theme: Payload's theme cookie, else the `Sec-CH-Prefers-Color-Scheme` client hint, else light. That is what guests
 * got before too: Payload's ThemeProvider only follows the system theme when the client config has `admin.theme`,
 * and the unauthenticated client config a guest gets has none (its inline script was undone at hydration).
 */
import '@payloadcms/next/css'
import '@payloadcms/ui/css/app.css'
import type { Viewport } from 'next'
import { Inter, Roboto_Mono } from 'next/font/google'
import { cookies, headers } from 'next/headers'
import React from 'react'

import '../custom.css'

// Same fonts and CSS variables as Payload's RootLayout (@payloadcms/next/dist/adapters/layout.js)
const inter = Inter({ subsets: ['latin'], variable: '--font-family-sans' })
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-family-mono' })

// Same as Payload's `generatePayloadViewport` (no zoom-on-focus on iPhone)
export const generateViewport = async (): Promise<Viewport> => {
  const userAgent = (await headers()).get('user-agent') ?? ''
  return { initialScale: 1, width: 'device-width', ...(/\biPhone\b/.test(userAgent) ? { maximumScale: 1 } : {}) }
}

type Theme = 'dark' | 'light'
const isTheme = (value: string | undefined): value is Theme => value === 'dark' || value === 'light'

// Same order as Payload's getRequestTheme: theme cookie, then the client hint, else light
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()])
  const fromCookie = cookieStore.get('payload-theme')?.value
  const fromHeader = headerList.get('sec-ch-prefers-color-scheme') ?? undefined
  const theme: Theme = isTheme(fromCookie) ? fromCookie : isTheme(fromHeader) ? fromHeader : 'light'
  const highContrast = cookieStore.get('payload-high-contrast-mode')?.value === 'true'

  return (
    <html
      className={`${inter.variable} ${robotoMono.variable}`}
      data-enhanced-contrast={highContrast ? '' : undefined}
      data-theme={theme}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <style>{'@layer payload-default, payload;'}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
