// Excalidraw loads its fonts at runtime. Serve them from our own domain
// (public/excalidraw/fonts, copied from @excalidraw/excalidraw/dist/prod/fonts) instead of a CDN.
// Must run before Excalidraw renders or exports anything.
declare global {
    interface Window {
        EXCALIDRAW_ASSET_PATH?: string | string[]
    }
}

if (typeof window !== 'undefined') {
    window.EXCALIDRAW_ASSET_PATH = '/excalidraw/'
}

export {}
