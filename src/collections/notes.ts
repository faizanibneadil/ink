import { FixedToolbarFeature, TableFeature, lexicalEditor } from "@payloadcms/richtext-lexical";
import { CollectionConfig } from "payload";

import { CodeBlockFeature } from "@/features/code-block";
import { ExcalidrawFeature } from "@/features/excalidraw";

import { slugifyNote } from "./note-slug";

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
                return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    TableFeature(),
                    ExcalidrawFeature(),
                    CodeBlockFeature(),
                ]
            },
            views: "@/views/config.tsx#views"
        })
    }, {
        // Native Payload slug field (unique + indexed). Made once, from the note's first heading /
        // paragraph, max 60 characters (see ./note-slug.ts). Used by the /admin/tack/<slug> view.
        name: "slug",
        type: "slug",
        useAsSlug: "note",
        slugify: slugifyNote,
    }]
}