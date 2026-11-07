/**
 * What the Media collection accepts. Shared by the server (src/collections/Media.ts) and the note page's image drawer
 * (src/views/note-header/header-images.ts), so the browser's checks and the server's never drift apart.
 *
 * Images only: no SVG (it can carry scripts and is served from this site), no other files. This applies to everyone,
 * admins included, and to every way in (REST, the admin UI, the local API, the Worker).
 */
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'] as const

/** Largest file the Media collection accepts: 10 MB. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export const TOO_LARGE_MESSAGE = 'This image is too large. The maximum is 10 MB.'
