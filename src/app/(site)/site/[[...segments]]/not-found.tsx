import type { Metadata } from 'next'
import Link from 'next/link'

import './not-found.css'

export const metadata: Metadata = { title: 'Nothing found' }

/**
 * Guest website 404: the markup of Payload's NotFound view (@payloadcms/ui/dist/views/NotFound), which guests saw
 * before, so it keeps the same text and styles (`.not-found`, `.btn` from Payload's global CSS) without the admin's
 * client code. The link goes to `/`: the landing page for a guest.
 */
export default function SiteNotFound() {
  return (
    <div className="site-not-found">
      <div className="not-found">
        <div className="not-found__wrap">
          <div className="not-found__content">
            <h1>Nothing found</h1>
            <p>Sorry—there is nothing to correspond with your request.</p>
          </div>
          <Link className="btn btn--size-medium btn--withoutPopup btn--style-primary" href="/">
            <span className="btn__content">
              <span className="btn__label">Back to Dashboard</span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
