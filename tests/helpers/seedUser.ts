import { getPayload } from 'payload'

import type { User } from '../../src/payload-types.js'
import config from '../../src/payload.config.js'

/**
 * Admin used by the admin e2e tests. Users log in with their username (`loginWithUsername`, email login is off, see
 * src/collections/Users.ts), so the user is identified by username; no email is needed. Unique per run, so a test run
 * never touches a real account.
 */
export const testUser: Pick<User, 'role' | 'username'> & { password: string } = {
  // The Payload admin is admins-only (see src/app/[[...segments]]/page.tsx)
  role: 'admin',
  password: 'e2e-admin-pass-1234',
  username: `e2e-admin-${Date.now().toString(36)}`,
}

const removeTestUser = async () => {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'users',
    overrideAccess: true,
    where: { username: { equals: testUser.username } },
  })
}

/** Seeds the admin for the e2e admin tests (re-created if it exists), optionally with an email address. */
export async function seedTestUser(extra: { email?: string } = {}): Promise<void> {
  await removeTestUser()
  const payload = await getPayload({ config })
  await payload.create({ collection: 'users', data: { ...testUser, ...extra }, overrideAccess: true })
}

/** Removes the test admin after the tests. */
export async function cleanupTestUser(): Promise<void> {
  await removeTestUser()
}
