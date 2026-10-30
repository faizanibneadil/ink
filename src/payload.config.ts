import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { CodeBlock, lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Folders } from './collections/Folders'
import { Tags } from './collections/Tags'
import { Whiteboard } from './blocks/whiteboard/config'
import { Notes } from './collections/notes'
import { Settings } from './globals/settings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      views: {
        note: {
          path: "/tack",
          Component: "@/views/note.tsx#Note",
        }
      },
      graphics: {
        Logo: "@/graphics/logo/logo.tsx#Logo",
        Icon: "@/graphics/icon/icon.tsx#Icon"
      }
    }
  },
  blocks: [Whiteboard, CodeBlock({
    defaultLanguage: "ts",
    fieldOverrides: {
      slug: "CodeBlock"
    },
    languages: {
      plaintext: "Plain Text",
      js: "JavaScript",
      ts: "TypeScript",
      tsx: "TSX",
      jsx: "JSX"
    }
  })],
  collections: [Users, Media, Folders, Tags, Notes],
  globals: [Settings],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => {
      return [...defaultFeatures]
    }
  }),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteAdapter({
    blocksAsJSON: true,
    transactionOptions: {
      behavior: "deferred"
    },
    client: {
      url: process.env.DATABASE_URL || '',
    },
  }),
  localization: {
    locales: [{ code: 'en', label: 'English' }],
    fallback: true,
    defaultLocale: 'en',
  },
  plugins: [mcpPlugin({})],
})
