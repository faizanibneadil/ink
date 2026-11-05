import { FixedToolbarFeature, TableFeature, lexicalEditor } from "@payloadcms/richtext-lexical";
import { CollectionConfig } from "payload";

import { CodeBlockFeature } from "@/features/code-block";
import { ExcalidrawFeature } from "@/features/excalidraw";

import { slugifyNote, validateNoteSlug } from "./note-slug";

export const Notes: CollectionConfig = {
    slug: "notes",
    access: {
        // Anyone can read a note (`/<slug>` shows it to guests). Changing notes needs a login.
        create: ({ req }) => Boolean(req.user),
        delete: ({ req }) => Boolean(req.user),
        read: () => true,
        update: ({ req }) => Boolean(req.user),
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
        // paragraph, max 60 characters (see ./note-slug.ts). The note is shown at `/<slug>`
        // (src/app/[[...segments]]/page.tsx); slugs that are Payload admin routes get a `-note` suffix.
        name: "slug",
        type: "slug",
        useAsSlug: "note",
        slugify: slugifyNote,
        validate: validateNoteSlug,
    }]
}