import { expect, test } from '@playwright/test'

const fixtureTitle = (number: number) => `Pagi Browser Fixture ${String(number).padStart(3, '0')}`

test('offset Pagi traverses three seeded pages and keeps the URL position', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/home/post?page=1')
  await page.waitForLoadState('networkidle')

  const pageNumber = page.getByRole('spinbutton', { name: '页码' })
  await expect(pageNumber).toHaveValue('1')
  await expect(page.getByRole('link', { name: fixtureTitle(60), exact: true })).toBeVisible()

  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page).toHaveURL(/\/home\/post\?page=2$/)
  await expect(pageNumber).toHaveValue('2')
  await expect(page.getByRole('link', { name: fixtureTitle(40), exact: true })).toBeVisible()

  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page).toHaveURL(/\/home\/post\?page=3$/)
  await expect(pageNumber).toHaveValue('3')
  await expect(page.getByRole('link', { name: fixtureTitle(20), exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '下一页' })).toBeVisible()

  await page.getByRole('button', { name: '上一页' }).click()
  await expect(page).toHaveURL(/\/home\/post\?page=2$/)
  await expect(pageNumber).toHaveValue('2')
})

test('mobile Pagi loads the next cursor page when scrolling', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'sec-ch-ua-mobile': '?1' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/home/post')
  await expect(page.getByRole('link', { name: fixtureTitle(60), exact: true })).toBeVisible()

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(page.getByRole('link', { name: fixtureTitle(40), exact: true })).toBeVisible()
})

test('expanded replies load another cursor page on demand', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/home/post?page=1')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: fixtureTitle(55), exact: true }).click()

  await expect(page.getByText('Pagi Browser Main Comment 1', { exact: true })).toBeVisible()
  await page.getByText('查看全部 60 条回复', { exact: true }).click()
  const loadMore = page.getByRole('button', { name: '加载更多' })
  await expect(loadMore).toBeVisible()

  const replies = page.getByText(/Pagi Browser Reply \d+/)
  const firstPageCount = await replies.count()
  expect(firstPageCount).toBeGreaterThan(0)
  await loadMore.click()
  await expect.poll(() => replies.count()).toBeGreaterThan(firstPageCount)
})
