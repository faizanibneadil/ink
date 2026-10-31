import type { Metadata } from 'next'

import { getSiteSettings } from '@/utilities/getSiteSettings'

// Rendered on every request (reads the site icon from Payload).
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { icon } = await getSiteSettings()
  const iconURL = typeof icon === 'object' && icon?.url ? icon.url : undefined

  return {
    title: 'Payload Blank Template',
    icons: iconURL
      ? {
          icon: [
            { url: iconURL },
            { url: iconURL, type: 'image/svg', sizes: '32x32' },
            { url: iconURL, type: 'image/svg', sizes: '16x16' },
          ],
          apple: [{ url: iconURL, sizes: '180x180' }],
        }
      : undefined,
  }
}

export default function HomePage() {
  return (
    <div className="home" data-test="payload-ui-barrel-sentinel">
      <div className="content">
        <picture>
          <source srcSet="https://raw.githubusercontent.com/payloadcms/payload/main/packages/ui/src/assets/payload-favicon.svg" />
          <img
            alt="Payload Logo"
            height={65}
            src="https://raw.githubusercontent.com/payloadcms/payload/main/packages/ui/src/assets/payload-favicon.svg"
            width={65}
          />
        </picture>
        <h1>Welcome to your new project.</h1>
        <div className="links">
          <a className="admin" href="/admin" rel="noopener noreferrer" target="_blank">
            Go to admin panel
          </a>
          <a
            className="docs"
            href="https://payloadcms.com/docs"
            rel="noopener noreferrer"
            target="_blank"
          >
            Documentation
          </a>
        </div>
      </div>
      <div className="footer">
        <p>Update this page by editing</p>
        <code className="codeLink">src/app/(frontend)/page.tsx</code>
      </div>
    </div>
  )
}
