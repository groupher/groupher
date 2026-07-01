import { expect, test } from '@playwright/test'

test('main post thread renders', async ({ page }) => {
  await page.goto('/home/post', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/home\/post/)

  // Assert mocked content rendered (not just navigation)
  await expect(page.getByRole('link', { name: 'Mock Post #1' })).toBeVisible()
})
