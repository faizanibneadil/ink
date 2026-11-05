import { isPayloadRoute } from "@/utilities/isPayloadRoute"
import payloadConfig from "@payload-config"
import { headers as getHeaders } from "next/headers"


export default async function Layout(props: LayoutProps<'/[[...segments]]'>) {
    const [params, config, headers] = await Promise.all([props.params, payloadConfig, getHeaders()])

    const isPayload = isPayloadRoute({ config, params, headers })

    return isPayload
        ? props.children
        : <div>Website</div>

}