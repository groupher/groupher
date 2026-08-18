import { expect, test } from '@playwright/test'

test('dashboard overview renders', async ({ page }) => {
  await page.goto('/home')
  await expect(page).toHaveURL(/\/home$/)

  // Assert a stable UI element from the dashboard overview portal.
  await expect(page.getByTestId('dashboard-overview-title')).toBeVisible()
})
