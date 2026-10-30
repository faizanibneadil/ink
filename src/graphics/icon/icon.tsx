import { ServerComponentProps } from "payload"

export const Icon: React.FC<ServerComponentProps> = async (props) => {
    const icon = await props.payload.findGlobal({
        slug: "settings",
        select: {
            icon: true
        }
    })

    const url = typeof icon?.icon === "object" && icon?.icon?.url && icon?.icon?.url
    const alt = typeof icon?.icon === "object" && icon?.icon?.alt && icon?.icon?.alt
    return url ? <img src={url} alt={alt || "Site Icon"} style={{ width: "20px", height: "20px" }} /> : null
}