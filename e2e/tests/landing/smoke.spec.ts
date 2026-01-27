import { expect, test } from '@playwright/test'

test('landing home renders', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
})
