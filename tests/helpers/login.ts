import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface LoginOptions {
  page: Page
  serverURL?: string
  user: {
    password: string
    username: string
  }
}

/**
 * Logs an admin into the Payload admin through the login form (username + password: users log in with their
 * username, see src/collections/Users.ts) and waits for the dashboard (`/`).
 */
export async function login({ page, serverURL = 'http://localhost:3000', user }: LoginOptions): Promise<void> {
  await page.goto(`${serverURL}/login`)

  await page.fill('#field-username', user.username)
  await page.fill('#field-password', user.password)
  await Promise.all([
    page.waitForURL(`${serverURL}/`, { timeout: 60000 }),
    page.click('button[type="submit"]'),
  ])

  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 60000 })
}
