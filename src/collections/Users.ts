import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    loginWithUsername: {
      allowEmailLogin: false,
      requireEmail: false,
      requireUsername: true
    },
    passwordHashIterations: 100000
  },
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
  versions: false,
}
