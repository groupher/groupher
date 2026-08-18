import { expect, test } from '@playwright/test'

test('tanstack dashboard overview renders', async ({ page }) => {
  await page.goto('/home/overview')
  await expect(page).toHaveURL(/\/home\/overview/)
  await expect(page.getByTestId('dashboard-overview-title')).toBeVisible()
})
