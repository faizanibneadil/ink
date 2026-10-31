import { GlobalConfig } from "payload";

export const Settings: GlobalConfig = {
    slug: "settings",
    versions: false,
    access: {
        read: () => true,
        update: ({ req }) => req?.user?.username === "superadmin",
    },
    fields: [{
        type: "group",
        fields: [{
            type: "row",
            fields: [{
                type: "upload",
                name: "logo",
                label: "Site Logo",
                relationTo: "media"
            }, {
                type: "upload",
                name: "icon",
                label: "Site Icon",
                relationTo: "media"
            }]
        }]
    }]
}