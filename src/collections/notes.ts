import { FixedToolbarFeature, TableFeature, lexicalEditor } from "@payloadcms/richtext-lexical";
import { CollectionConfig } from "payload";

import { CodeBlockFeature } from "@/features/code-block";
import { ExcalidrawFeature } from "@/features/excalidraw";

import { ACCEPTED_IMAGE_TYPES } from "./media-rules";
import { COVER_POSITION_DEFAULT, COVER_POSITION_MAX, COVER_POSITION_MIN } from "./note-header";
import { slugifyNote, validateNoteSlug } from "./note-slug";

/**
 * Only images the Media collection accepts can be a note's cover or icon (checked by Payload on the server too, not
 * only in the picker). An exact list, not "image/*": an SVG uploaded before Media was limited to images stays refused.
 */
const imagesOnly = { mimeType: { in: [...ACCEPTED_IMAGE_TYPES] } }

export const Notes: CollectionConfig = {
    slug: "notes",
    admin: {
        // Notes have no title field: the slug (made from the first heading / paragraph) names them in the admin
        useAsTitle: "slug",
        // Grid / card views show the note's icon
        useAsThumbnail: "icon",
    },
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
        // (src/app/(payload)/[[...segments]]/page.tsx); slugs that are Payload admin routes get a `-note` suffix.
        name: "slug",
        type: "slug",
        useAsSlug: "note",
        slugify: slugifyNote,
        validate: validateNoteSlug,
    }, {
        // Notion-style page header (src/views/note-header): wide cover photo + rounded-square icon
        name: "cover",
        type: "upload",
        relationTo: "media",
        filterOptions: imagesOnly,
        admin: { position: "sidebar" },
    }, {
        // Vertical position of the cover photo (CSS `object-position: center <n>%`), set by "Reposition"
        name: "coverPosition",
        type: "number",
        defaultValue: COVER_POSITION_DEFAULT,
        min: COVER_POSITION_MIN,
        max: COVER_POSITION_MAX,
        admin: {
            position: "sidebar",
            description: "Vertical position of the cover photo, 0 (top) to 100 (bottom).",
            step: 1,
        },
    }, {
        name: "icon",
        type: "upload",
        relationTo: "media",
        filterOptions: imagesOnly,
        admin: { position: "sidebar" },
    }]
}