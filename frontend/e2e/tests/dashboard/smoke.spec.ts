import { expect, test } from '@playwright/test'

test('dashboard overview renders', async ({ page }) => {
  // The dashboard app root ("/") is a proxy placeholder page.
  // Real dashboard pages live under `/:community/dashboard/*`.
  await page.goto('/home/dashboard')
  await expect(page).toHaveURL(/\/home\/dashboard/)

  // Assert a stable UI element from the dashboard overview portal.
  await expect(page.getByTestId('dashboard-overview-title')).toBeVisible()
})
