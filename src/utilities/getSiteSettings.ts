import { createServerFn } from "@tanstack/react-start";
import { getPayload } from "payload";
import config from "@payload-config"

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
    const payload = await getPayload({ config })
    const siteSettings = await payload.findGlobal({
        slug: "settings",
        select: {
            icon: true
        }
    })

    return {
        icon: siteSettings?.icon
    }
})