import { expect, test } from '@playwright/test'
import { JSDOM } from 'jsdom'

const cases = [
  { name: 'explicit first page', path: '/home/post?page=1', headers: {} },
  { name: 'default first page without device hints', path: '/home/post', headers: {} },
  { name: 'mobile first page', path: '/home/post', headers: { 'sec-ch-ua-mobile': '?1' } },
  { name: 'explicit desktop hint', path: '/home/post', headers: { 'sec-ch-ua-mobile': '?0' } },
  { name: 'invalid hint', path: '/home/post', headers: { 'sec-ch-ua-mobile': 'unknown' } },
  { name: 'mobile page one', path: '/home/post?page=1', headers: { 'sec-ch-ua-mobile': '?1' } },
  {
    name: 'saved page after switching to cursor',
    path: '/home/post?page=4',
    headers: { 'sec-ch-ua-mobile': '?1' },
  },
  { name: 'saved cursor after switching to pages', path: '/home/post?after=opaque', headers: {} },
] satisfies { name: string; path: string; headers: Record<string, string> }[]

for (const { name, path, headers } of cases) {
  test(name, async ({ request }) => {
    const response = await request.get(path, {
      headers: { host: 'community.groupher.localhost', ...headers },
      maxRedirects: 0,
    })
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/html')
    const { document } = new JSDOM(await response.text()).window
    expect(response.headers()['cache-control']).toContain('no-store')
    const mode = headers['sec-ch-ua-mobile'] === '?1' ? 'INFINITE_SCROLL' : 'PAGE'
    const list = document.querySelector(`[data-pagination-mode="${mode}"]`)
    expect(list).toBeTruthy()
    if (path.includes('page=4') || path.includes('after=opaque')) {
      expect(document.querySelector('p[role="status"]')?.textContent).toMatch(/第一页|first page/i)
    }
    for (const id of [1, 2, 3]) {
      const links = Array.from(list!.querySelectorAll(`a[href="/home/post/${id}"]`))
      expect(links.map((link) => link.textContent?.trim())).toContain(`Mock Post #${id}`)
    }
  })
}

test('valid shared cursor retains its position in desktop and mobile SSR', async ({ request }) => {
  const cursor = Buffer.from(
    JSON.stringify({
      cursor_version: 1,
      key_version: 1,
      payload: {
        cursor: 'mock:posts:home:1',
        surface: 'posts:home',
        order: {},
        fingerprint: 'posts:home',
      },
      signature: 'mock',
    }),
  ).toString('base64url')
  for (const mobile of ['?0', '?1']) {
    const response = await request.get(`/home/post?after=${cursor}`, {
      headers: { host: 'community.groupher.localhost', 'sec-ch-ua-mobile': mobile },
    })
    expect(response.status()).toBe(200)
    const document = new JSDOM(await response.text()).window.document
    const list = document.querySelector('[data-pagination-mode]')
    expect(list?.textContent).toContain('Mock Post #2')
    expect(list?.textContent).not.toContain('Mock Post #1')
    if (mobile === '?0') expect(list?.textContent).toMatch(/返回分页列表|Return to paginated list/)
  }
})

test('invalid cursor converges to the filtered URL after hydration and reload', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.goto(
    'http://community.groupher.localhost:3107/home/post?after=opaque&order=publish#section',
  )
  await expect(page).toHaveURL(/\/home\/post\?order=publish#section$/, { timeout: 20_000 })
  await expect(page.getByRole('link', { name: 'Mock Post #1', exact: true })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/home\/post\?order=publish#section$/, { timeout: 20_000 })
  await expect(page.getByRole('link', { name: 'Mock Post #1', exact: true })).toBeVisible()
})

test('shared cursor returns to the configured page list', async ({ page }) => {
  test.setTimeout(60_000)
  const cursor = Buffer.from(
    JSON.stringify({
      cursor_version: 1,
      key_version: 1,
      payload: {
        cursor: 'mock:posts:home:1',
        surface: 'posts:home',
        order: {},
        fingerprint: 'posts:home',
      },
      signature: 'mock',
    }),
  ).toString('base64url')
  await page.goto(
    `http://community.groupher.localhost:3107/home/post?after=${cursor}&order=publish#section`,
  )
  await expect(page.getByRole('link', { name: 'Mock Post #2', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mock Post #1', exact: true })).toHaveCount(0)
  const returnLink = page.getByRole('link', { name: /返回分页列表|Return to paginated list/ })
  await expect(returnLink).toHaveAttribute('href', /#section$/, { timeout: 20_000 })
  await returnLink.click()
  await expect(page).toHaveURL(/\/home\/post\?order=publish#section$/, { timeout: 20_000 })
  await expect(page.getByRole('link', { name: 'Mock Post #1', exact: true })).toBeVisible()
})

test('sorting after cursor recovery keeps the URL clean', async ({ page }) => {
  await page.goto('http://community.groupher.localhost:3107/home/post?after=opaque#section')
  await expect(page).toHaveURL(/\/home\/post#section$/, { timeout: 15_000 })
  await page.getByText('Sort', { exact: true }).click()
  await page.getByText('Upvotes', { exact: true }).click()
  await expect
    .poll(() => new URL(page.url()).searchParams.get('order'), { timeout: 15_000 })
    .toBe('UPVOTES')
  expect(new URL(page.url()).searchParams.has('after')).toBe(false)
  expect(new URL(page.url()).hash).toBe('#section')
  await page.reload()
  expect(new URL(page.url()).searchParams.has('after')).toBe(false)
})

test('narrow viewport without a device hint keeps posts and pagination usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://community.groupher.localhost:3107/home/post')
  await expect(page.locator('[data-pagination-mode="PAGE"]')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mock Post #1', exact: true })).toBeVisible()
  await expect(page.getByText('Sort', { exact: true })).toBeVisible()
})

test('post pagination preserves the URL hash on next and previous page', async ({ page }) => {
  await page.goto('http://community.groupher.localhost:3107/pagi-hash/post?order=UPVOTES#section')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page).toHaveURL(/\/pagi-hash\/post\?order=UPVOTES&page=2#section$/, {
    timeout: 20_000,
  })
  await page.getByRole('button', { name: '上一页' }).click()
  await expect(page).toHaveURL(/\/pagi-hash\/post\?order=UPVOTES#section$/, { timeout: 20_000 })
})
