
import configPromise from "@payload-config"
import { getPayload } from "payload"
import { NextRequest, NextResponse, userAgent } from "next/server"

import type { User } from "./payload-types"
import { payloadSegments } from "./utilities/isPayloadRoute"

const viewportTypes = {
    mobile: "m",
    desktop: "d",
    tablet: "t",
} as const

type ViewType = "db" | "web"
type ViewportType = (typeof viewportTypes)[keyof typeof viewportTypes]

const canAccessDatabaseView = (role: User["role"] | undefined) => {
    return role === "admin" || role === "moderator"
}

const getDefaultViewType = (
    role: User["role"] | undefined
): ViewType => {
    return canAccessDatabaseView(role) ? "db" : "web"
}

const getRequestedViewType = (req: NextRequest): ViewType | undefined => {
    const searchParamViewType = req.nextUrl.searchParams.get("vt")
    const headerViewType = req.headers.get("x-view-type")

    if (searchParamViewType === "db" || searchParamViewType === "web") {
        return searchParamViewType
    }

    if (headerViewType === "db" || headerViewType === "web") {
        return headerViewType
    }

    return undefined
}

const resolveViewType = ({
    role,
    requestedViewType,
}: {
    role: User["role"] | undefined
    requestedViewType: ViewType | undefined
}): ViewType => {
    /*
     * Admin aur moderator existing view ko preserve kar sakte hain
     * aur website/dashboard ke darmiyan switch kar sakte hain.
     */
    if (canAccessDatabaseView(role)) {
        return requestedViewType ?? getDefaultViewType(role)
    }

    /*
     * Normal user aur unauthenticated visitor ko dashboard
     * access nahi diya jayega.
     */
    return "web"
}

const resolveViewportType = (req: NextRequest): ViewportType => {
    const searchParamViewportType = req.nextUrl.searchParams.get("vp")
    const headerViewportType = req.headers.get("x-viewport-type")

    const validViewportTypes = Object.values(viewportTypes)

    if (
        searchParamViewportType &&
        validViewportTypes.includes(
            searchParamViewportType as ViewportType
        )
    ) {
        return searchParamViewportType as ViewportType
    }

    if (
        headerViewportType &&
        validViewportTypes.includes(
            headerViewportType as ViewportType
        )
    ) {
        return headerViewportType as ViewportType
    }

    const {
        device: { type = "desktop" },
    } = userAgent(req)

    return viewportTypes[
        type as keyof typeof viewportTypes
    ] ?? viewportTypes.desktop
}

export async function proxy(req: NextRequest) {
    const redirectUrl = req.nextUrl.clone()

    const pathnameSegments = redirectUrl.pathname.split("/")

    const isPayloadInternalRoute = pathnameSegments.some((segment) => {
        return payloadSegments.includes(segment)
    })

    if (isPayloadInternalRoute) {
        return NextResponse.next()
    }

    const payload = await getPayload({
        config: configPromise,
    })

    const { user } = await payload.auth({
        headers: req.headers,
    })

    const requestedViewType = getRequestedViewType(req)

    const viewType = resolveViewType({
        role: user?.role,
        requestedViewType,
    })

    const viewportType = resolveViewportType(req)

    const currentViewType = req.nextUrl.searchParams.get("vt")
    const currentViewportType = req.nextUrl.searchParams.get("vp")

    const shouldRedirect =
        currentViewType !== viewType ||
        currentViewportType !== viewportType

    /*
     * URL mein values missing ya incorrect hon to pehle
     * canonical URL par redirect karo.
     */
    if (shouldRedirect) {
        redirectUrl.searchParams.set("vt", viewType)
        redirectUrl.searchParams.set("vp", viewportType)

        return NextResponse.redirect(redirectUrl)
    }

    /*
     * URL ke search params correct hain.
     * Ab same values request headers mein bhi forward karo.
     */
    const requestHeaders = new Headers(req.headers)

    requestHeaders.set("x-view-type", viewType)
    requestHeaders.set("x-viewport-type", viewportType)

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
}