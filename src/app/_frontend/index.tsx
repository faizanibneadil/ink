import { createFileRoute } from '@tanstack/react-router'
import { getPayload } from 'payload'
import config from "@payload-config"
import { getSiteSettings } from '@/utilities/getSiteSettings'


export const Route = createFileRoute('/_frontend/')({
  loader: async () => ({ icon: (await getSiteSettings())?.icon }),
  component: HomePage,
  head: ({ loaderData }) => ({
    meta: [{ title: 'Payload TanStack Blank Template' }],
    links: typeof loaderData?.icon === "object" && loaderData?.icon?.url ? [
      { rel: 'icon', href: loaderData?.icon?.url! },
      { rel: 'icon', type: 'image/svg', sizes: '32x32', href: loaderData?.icon?.url! },
      { rel: 'icon', type: 'image/svg', sizes: '16x16', href: loaderData?.icon?.url! },
      { rel: 'apple-touch-icon', sizes: '180x180', href: loaderData?.icon?.url! },
    ] : [],
  }),
})

function HomePage() {
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
        <code className="codeLink">src/app/_frontend/index.tsx</code>
      </div>
    </div>
  )
}
