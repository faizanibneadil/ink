import { ServerComponentProps } from "payload"

export const Logo: React.FC<ServerComponentProps> = async (props) => {
    const logo = await props.payload.findGlobal({
        slug: "settings",
        select: {
            logo: true
        }
    })

    const url = typeof logo?.logo === "object" && logo?.logo?.url && logo?.logo?.url
    const alt = typeof logo?.logo === "object" && logo?.logo?.alt && logo?.logo?.alt
    return <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", justifyContent: "center" }}>
        {url ? <img src={url} alt={alt || "Site Logo"} style={{ width: "100px", height: "100px" }} /> : null}
        <h1 style={{ fontSize: "28px" }}>Ink</h1>
        <p style={{ fontSize: "10px" }}>Powered by DevSlix</p>
    </div>
}