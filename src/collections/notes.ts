import { BlocksFeature, FixedToolbarFeature, TableFeature, lexicalEditor } from "@payloadcms/richtext-lexical";
import { CollectionConfig } from "payload";

export const Notes: CollectionConfig = {
    slug: "notes",
    access: {
        create: () => true,
        delete: () => true,
        read: () => true,
        update: () => true,
    },
    versions: false,
    fields: [{
        type: "richText",
        name: "note",
        admin: { className: "notion-field" },
        editor: lexicalEditor({
            features: ({ rootFeatures }) => {
                return [...rootFeatures, BlocksFeature({
                    blocks: ['whiteboard', 'CodeBlock']
                }), FixedToolbarFeature(), TableFeature()]
            },
            views: "@/views/config.tsx#views"
        })
    }]
}