import type { Access, CollectionConfig, FieldAccess } from 'payload'

import type { User } from '@/payload-types'

export const USER_ROLES = ['admin', 'user'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const isAdminUser = (user: unknown): boolean =>
  Boolean(user && typeof user === 'object' && (user as Partial<User>).role === 'admin')

/** Admins: every user. Others: only their own account. */
const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }
  if (isAdminUser(user)) {
    return true
  }
  return { id: { equals: user.id } }
}

const adminOnly: Access = ({ req: { user } }) => isAdminUser(user)

/** Only admins may set or change a role, so a `user` can never make itself `admin`. */
const adminOnlyField: FieldAccess = ({ req: { user } }) => isAdminUser(user)

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  /*
   * `access.admin` stays at Payload's default (any logged-in user): the website note editor (`/<noteSlug>`) uses
   * Payload server functions (form state) that require it. The Payload admin pages themselves are admins-only:
   * src/app/[[...segments]]/page.tsx redirects a logged-in non-admin to `/`.
   *
   * `create`: the first user is still created on /create-first-user (Payload skips access control there).
   */
  access: {
    create: adminOnly,
    delete: adminOrSelf,
    read: adminOrSelf,
    update: adminOrSelf,
  },
  hooks: {
    beforeChange: [
      // The very first user (created on /create-first-user, nobody logged in) must be an admin, otherwise nobody
      // could ever open the Payload dashboard.
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req })
          if (totalDocs === 0) {
            return { ...data, role: 'admin' }
          }
        }
        return data
      },
    ],
  },
  auth: {
    // Per-user API keys ("Enable API Key" on the user's page). MCP clients authenticate to `/api/mcp` with the header
    // `Authorization: users API-Key <key>` (see src/mcp.ts). An API key acts as that user, with that user's role.
    useAPIKey: true,
    loginWithUsername: {
      allowEmailLogin: false,
      requireEmail: false,
      requireUsername: true,
    },
  },
  fields: [
    // Email added by default
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      options: USER_ROLES.map((role) => ({ label: role === 'admin' ? 'Admin' : 'User', value: role })),
      // Available on `req.user` without a database lookup (it is part of the login token).
      saveToJWT: true,
      access: {
        create: adminOnlyField,
        update: adminOnlyField,
      },
    },
  ],
  versions: false,
}
