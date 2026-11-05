import { match } from "path-to-regexp"
import type { SanitizedConfig } from "payload"

export const payloadSegments = [
    "create-first-user",
    "forgot",
    "login",
    "unauthorized",
    "logout-inactivity",
    "collections",
    "globals",
    "logout",
    "account",
]

export const isPayloadRoute = ({
    config,
    params,
    headers,
    searchParams,
}: {
    config: SanitizedConfig
    params: Awaited<PageProps<"/[[...segments]]">["params"]>
    headers?: Headers
    searchParams?: Awaited<PageProps<"/[[...segments]]">["searchParams"]>
}) => {
    const segments = params?.segments ?? []
    const hasSegments = segments.length > 0

    const viewType = searchParams?.vt ?? headers?.get("x-view-type")

    /*
     * Root route:
     * /?vt=db  => Payload dashboard
     * /?vt=web => Website landing page
     */
    if (!hasSegments) {
        return viewType === "db"
    }

    const firstSegment = segments[0]
    const pathname = `/${segments.join("/")}`

    /*
     * Payload built-in routes always render Payload,
     * regardless of viewType.
     */
    if (payloadSegments.includes(firstSegment)) {
        return true
    }

    /*
     * Payload custom views always render Payload,
     * regardless of viewType.
     */
    const views = config.admin?.components?.views ?? {}

    const isPayloadCustomView = Object.values(views).some((view) => {
        if (!view?.path) {
            return false
        }

        const matcher = match(view.path, {
            end: view.exact === true,
            sensitive: view.sensitive === true,
            trailing: view.strict !== true,
            decode: decodeURIComponent,
        })

        return Boolean(matcher(pathname))
    })

    return isPayloadCustomView
}