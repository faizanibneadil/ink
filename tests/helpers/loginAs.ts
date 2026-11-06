import { expect, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import type { User } from '../../src/payload-types.js'
import config from '../../src/payload.config.js'

export type TestAccount = { password: string; role: User['role']; username: string }

/** Creates (or re-creates) a user through the local API. Users log in with their username (see src/collections/Users.ts). */
export async function seedAccount(account: TestAccount): Promise<User> {
  const payload = await getPayload({ config })
  await payload.delete({ collection: 'users', overrideAccess: true, where: { username: { equals: account.username } } })
  return (await payload.create({ collection: 'users', data: account, overrideAccess: true })) as User
}

export async function deleteAccount(username: string): Promise<void> {
  const payload = await getPayload({ config })
  await payload.delete({ collection: 'users', overrideAccess: true, where: { username: { equals: username } } })
}

/** Logs in through the Payload login form (username + password). */
export async function loginAs(page: Page, account: Pick<TestAccount, 'password' | 'username'>, base = 'http://localhost:3000') {
  await page.goto(`${base}/login`)
  await page.fill('#field-username', account.username)
  await page.fill('#field-password', account.password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 }),
    page.click('button[type="submit"]'),
  ])
  await expect(page).not.toHaveURL(/\/login/)
}
