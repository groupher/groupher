import { expect, test } from '@playwright/test'

test('Published Ticket edits are reviewed and republished without withdrawal', async ({
  page,
  baseURL,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page
    .context()
    .addCookies([{ name: 'groupher-auth.token', value: 'dash-smoke-token', url: baseURL! }])
  const interactive = page.waitForResponse(
    (response) =>
      response.url().includes('/api/graphql') &&
      (response.request().postData()?.includes('TicketAssigneeCandidates') ?? false),
  )
  await page.goto('/home/kanban/ticket/11111111-1111-4111-8111-111111111111')
  await interactive
  await expect(
    page.getByRole('heading', { name: 'E2E published ticket', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /Implement E2E fix/ })).toHaveAttribute(
    'href',
    /kanban\/ticket\/22222222/,
  )
  await page.locator('input[value="E2E published ticket"]').fill('Reviewed E2E title')
  await page.getByPlaceholder('Reason for visibility change').fill('Reviewed current content')
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click()
  const preview = page.getByRole('alertdialog')
  await expect(preview.getByText('Reviewed E2E title', { exact: true })).toBeVisible()
  await expect(preview.getByText('Complete Ticket body', { exact: true })).toBeVisible()
  await expect(preview.getByText(/Visible source Post/)).toBeVisible()
  await expect(preview.getByText('Public progress to review', { exact: true })).toBeVisible()
  await preview.getByRole('button', { name: 'Confirm republish', exact: true }).click()
  await expect(preview).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reviewed E2E title', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish changes', exact: true })).toBeVisible()
  await page.getByRole('link', { name: /Implement E2E fix/ }).click()
  await expect(page.getByRole('heading', { name: 'Implement E2E fix', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish changes', exact: true })).toHaveCount(0)
  expect(pageErrors).toEqual([])
})
