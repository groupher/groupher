import { expect, test } from '@playwright/test'

test('tanstack dashboard overview renders', async ({ page }) => {
  await page.goto('/home/dash/overview')
  await expect(page).toHaveURL(/\/home\/dash\/overview/)
  await expect(page.getByTestId('dashboard-overview-title')).toBeVisible()
})
