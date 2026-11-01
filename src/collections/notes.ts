import { BlocksFeature, FixedToolbarFeature, TableFeature, lexicalEditor } from "@payloadcms/richtext-lexical";
import { CollectionConfig } from "payload";

import { ExcalidrawFeature } from "@/features/excalidraw/feature.server";

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
                    blocks: ['CodeBlock']
                }), FixedToolbarFeature(), TableFeature(), ExcalidrawFeature()]
            },
            views: "@/views/config.tsx#views"
        })
    }]
}