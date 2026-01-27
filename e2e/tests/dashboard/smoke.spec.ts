import { expect, test } from '@playwright/test'

test('dashboard home renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('some thing wrong with proxy.')).toBeVisible()
})
