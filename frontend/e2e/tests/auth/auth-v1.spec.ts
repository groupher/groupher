import path from 'node:path'

import {
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  test,
} from '@playwright/test'

const AUTH_ORIGIN = 'http://auth.groupher.localhost:3104'
const DASH_ORIGIN = 'http://dash.groupher.localhost:3103'
const AUTH_LOOPBACK_ORIGIN = 'http://127.0.0.1:3104'
const MOCK_ORIGIN = 'http://127.0.0.1:4104'
const ACCESS_COOKIE = 'groupher-auth.token'
const HINT_COOKIE = 'groupher-auth.signed-in'
const SESSION_COOKIE = '__Host-groupher-auth.session-token'
const AUTH_HEADERS = { 'X-Groupher-CSRF': '1' }
const authClientModule = `/@fs${path.resolve('frontend/core/lib/graphql/client.ts')}`

type TAuthState = {
  sessions: Array<{
    browserFamily: string
    publicRef: string
    ref: string
    status: string
  }>
  stats: {
    protectedCalls: number
    refreshCalls: number
    revokeCalls: number
    signInCalls: number
  }
}

const resetStack = async (request: APIRequestContext): Promise<void> => {
  const responses = await Promise.all([
    request.post(`${MOCK_ORIGIN}/__e2e/auth/reset`),
    request.post('http://127.0.0.1:3104/__e2e/reset'),
  ])
  for (const response of responses) expect(response.ok()).toBe(true)
}

const readState = async (request: APIRequestContext): Promise<TAuthState> => {
  const response = await request.get(`${MOCK_ORIGIN}/__e2e/auth/state`)
  expect(response.ok()).toBe(true)
  return (await response.json()) as TAuthState
}

const testLogin = async (page: Page, login = 'e2e'): Promise<void> => {
  await page.goto(`${DASH_ORIGIN}/health`)
  const result = await page.evaluate(
    async ({ authOrigin, headers, loginName }) => {
      const response = await fetch(`${authOrigin}/api/auth/test-login`, {
        body: JSON.stringify({ login: loginName }),
        credentials: 'include',
        headers: { ...headers, 'Content-Type': 'application/json' },
        method: 'POST',
      })
      return { status: response.status }
    },
    { authOrigin: AUTH_ORIGIN, headers: AUTH_HEADERS, loginName: login },
  )
  expect(result.status).toBe(204)
}

const clearAccessCookie = async (context: BrowserContext): Promise<void> => {
  await context.clearCookies({ name: ACCESS_COOKIE })
  expect((await context.cookies()).some((cookie) => cookie.name === ACCESS_COOKIE)).toBe(false)
}

const runProtectedOperation = async (
  page: Page,
): Promise<{ data?: { me?: { login?: string } }; error?: string; status?: number }> =>
  page.evaluate(async (moduleUrl) => {
    try {
      const authModule = (await import(/* @vite-ignore */ moduleUrl)) as {
        createAuthFetch: () => typeof fetch
      }
      const response = await authModule.createAuthFetch()('/api/graphql', {
        body: JSON.stringify({ query: 'query AuthE2E { me { login nickname } }' }),
        headers: { 'Content-Type': 'application/json', 'X-Groupher-CSRF': '1' },
        method: 'POST',
      })
      return { ...(await response.json()), status: response.status }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, authClientModule)

const openAccountMenu = async (page: Page): Promise<void> => {
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible()
  await page.getByRole('button', { name: 'Open account menu' }).click()
}

test.describe('Auth V1 browser protocol', () => {
  test.beforeEach(async ({ request }) => resetStack(request))

  test('P0 refreshes a missing access cookie exactly once and retries the operation', async ({
    context,
    page,
    request,
  }) => {
    await testLogin(page)
    await page.goto(`${DASH_ORIGIN}/home/overview`)
    await expect(page.getByTestId('dashboard-overview-title')).toBeVisible()
    await clearAccessCookie(context)

    const refreshRequests: string[] = []
    page.on('request', (req) => {
      if (req.url() === `${AUTH_ORIGIN}/api/auth/token/refresh`) refreshRequests.push(req.url())
    })

    const result = await runProtectedOperation(page)

    expect(result.error).toBeUndefined()
    expect(result.data?.me?.login).toBe('e2e')
    expect(refreshRequests).toHaveLength(1)
    expect((await readState(request)).stats.refreshCalls).toBe(1)
  })

  test('P0 refreshes an expired access token exactly once and retries the operation', async ({
    page,
    request,
  }) => {
    await testLogin(page)
    await page.goto(`${DASH_ORIGIN}/home/overview`)
    await expect(page.getByTestId('dashboard-overview-title')).toBeVisible()

    const expireResponse = await request.post(`${MOCK_ORIGIN}/__e2e/auth/expire-access`)
    expect(expireResponse.ok()).toBe(true)

    const refreshRequests: string[] = []
    page.on('request', (req) => {
      if (req.url() === `${AUTH_ORIGIN}/api/auth/token/refresh`) refreshRequests.push(req.url())
    })

    const result = await runProtectedOperation(page)

    expect(result.error).toBeUndefined()
    expect(result.data?.me?.login).toBe('e2e')
    expect(refreshRequests).toHaveLength(1)
    expect((await readState(request)).stats.refreshCalls).toBe(1)
  })

  test('P0 remote revoke clears the revoked browser and leaves the revoker active', async ({
    browser,
    request,
  }) => {
    const contextA = await browser.newContext({ userAgent: 'E2E Browser A' })
    const contextB = await browser.newContext({ userAgent: 'E2E Browser B' })
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    try {
      await testLogin(pageA)
      await testLogin(pageB)
      await Promise.all([
        pageA.goto(`${DASH_ORIGIN}/home/overview`),
        pageB.goto(`${DASH_ORIGIN}/home/overview`),
      ])
      const state = await readState(request)
      const browserB = state.sessions.find((session) => session.browserFamily === 'E2E Browser B')
      expect(browserB).toBeDefined()

      const revokeStatus = await pageA.evaluate(
        async ({ authOrigin, headers, publicRef }) => {
          const response = await fetch(`${authOrigin}/api/auth/sessions/${publicRef}/revoke`, {
            credentials: 'include',
            headers,
            method: 'POST',
          })
          return response.status
        },
        { authOrigin: AUTH_ORIGIN, headers: AUTH_HEADERS, publicRef: browserB?.publicRef },
      )
      expect(revokeStatus).toBe(204)

      await clearAccessCookie(contextB)
      const revokedResult = await runProtectedOperation(pageB)
      expect(revokedResult.error).toContain('status 401')
      await expect(pageB.getByRole('button', { name: /Github/i })).toBeVisible()

      const remainingCookies = await contextB.cookies()
      expect(remainingCookies.some((cookie) => cookie.name === ACCESS_COOKIE)).toBe(false)
      expect(remainingCookies.some((cookie) => cookie.name === HINT_COOKIE)).toBe(false)
      expect(remainingCookies.some((cookie) => cookie.name === SESSION_COOKIE)).toBe(false)

      const revokerResult = await runProtectedOperation(pageA)
      expect(revokerResult.data?.me?.login).toBe('e2e')
      expect(revokerResult.error).toBeUndefined()
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })

  test('P0 recovers an authenticated SSR route once after hydration', async ({
    context,
    page,
    request,
  }) => {
    await testLogin(page)
    await clearAccessCookie(context)
    const refreshRequests: string[] = []
    page.on('request', (req) => {
      if (req.url() === `${AUTH_ORIGIN}/api/auth/token/refresh`) refreshRequests.push(req.url())
    })

    const response = await page.goto(`${DASH_ORIGIN}/home/overview`)
    expect(await response?.text()).toContain('Restoring your session')
    await expect(page.getByTestId('dashboard-overview-title')).toBeVisible({ timeout: 15_000 })

    expect(refreshRequests).toHaveLength(1)
    expect((await readState(request)).stats.refreshCalls).toBe(1)
  })

  test('P0 keeps the account visible after callback cookies reach the application', async ({
    context,
    page,
  }) => {
    await testLogin(page)

    expect((await context.cookies()).map((cookie) => cookie.name)).toEqual(
      expect.arrayContaining([ACCESS_COOKIE, HINT_COOKIE, SESSION_COOKIE]),
    )

    await page.goto(`${DASH_ORIGIN}/home/overview`)
    await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0)
  })

  test('P1 logout revokes the session, clears cookies, and signs out a sibling tab', async ({
    context,
    page,
    request,
  }) => {
    await testLogin(page)
    const sibling = await context.newPage()
    await Promise.all([
      page.goto(`${DASH_ORIGIN}/home/overview`),
      sibling.goto(`${DASH_ORIGIN}/home/overview`),
    ])
    await openAccountMenu(page)
    await page.getByRole('button', { name: /log out/i }).click()

    await expect(sibling.getByRole('button', { name: 'Sign in' })).toBeVisible()
    const cookies = await context.cookies()
    expect(cookies.some((cookie) => cookie.name === ACCESS_COOKIE)).toBe(false)
    expect(cookies.some((cookie) => cookie.name === HINT_COOKIE)).toBe(false)
    expect(cookies.some((cookie) => cookie.name === SESSION_COOKIE)).toBe(false)
    expect((await readState(request)).sessions[0]?.status).toBe('revoked')
  })

  test('P1 device drawer marks current and revokes one or all other sessions', async ({
    browser,
    request,
  }) => {
    const contexts = await Promise.all(
      ['A', 'B', 'C'].map((name) => browser.newContext({ userAgent: `E2E Browser ${name}` })),
    )
    const [, contextB, contextC] = contexts
    const [pageA, pageB, pageC] = await Promise.all(contexts.map((context) => context.newPage()))

    try {
      await testLogin(pageA)
      await testLogin(pageB)
      await testLogin(pageC)
      await Promise.all(
        [pageA, pageB, pageC].map((currentPage) =>
          currentPage.goto(`${DASH_ORIGIN}/home/overview`),
        ),
      )
      await openAccountMenu(pageA)
      await pageA.getByRole('button', { name: 'Login & devices' }).click()

      const rows = pageA.getByTestId('browser-session')
      await expect(rows).toHaveCount(3)
      await expect(rows.filter({ hasText: 'E2E Browser A' })).toHaveAttribute(
        'data-current-session',
        'true',
      )

      await rows
        .filter({ hasText: 'E2E Browser B' })
        .getByRole('button', { name: 'Revoke' })
        .click()
      await expect(rows).toHaveCount(2)
      await pageA.getByRole('button', { name: 'Revoke other devices' }).click()
      await expect(rows).toHaveCount(1)

      const state = await readState(request)
      expect(
        state.sessions.find((session) => session.browserFamily === 'E2E Browser A')?.status,
      ).toBe('active')
      expect(
        state.sessions.find((session) => session.browserFamily === 'E2E Browser B')?.status,
      ).toBe('revoked')
      expect(
        state.sessions.find((session) => session.browserFamily === 'E2E Browser C')?.status,
      ).toBe('revoked')

      await Promise.all([clearAccessCookie(contextB), clearAccessCookie(contextC)])
      expect((await runProtectedOperation(pageB)).error).toContain('status 401')
      expect((await runProtectedOperation(pageC)).error).toContain('status 401')
    } finally {
      await Promise.all(contexts.map((context) => context.close()))
    }
  })

  test('P2 exposes the exact Cookie contract and rejects an unapproved browser origin', async ({
    context,
    page,
    request,
  }) => {
    await testLogin(page)
    const cdp = await context.newCDPSession(page)
    const result = (await cdp.send('Network.getAllCookies')) as {
      cookies: Array<{
        domain: string
        httpOnly: boolean
        name: string
        path: string
        secure: boolean
      }>
    }
    const session = result.cookies.find((cookie) => cookie.name === SESSION_COOKIE)
    const access = result.cookies.find((cookie) => cookie.name === ACCESS_COOKIE)

    expect(session).toMatchObject({
      domain: 'auth.groupher.localhost',
      httpOnly: true,
      path: '/',
      secure: true,
    })
    expect(access).toMatchObject({
      domain: '.groupher.localhost',
      httpOnly: true,
      path: '/',
      secure: true,
    })

    const approvedStatus = await page.evaluate(
      async (authOrigin) =>
        (await fetch(`${authOrigin}/api/auth/session`, { credentials: 'include' })).status,
      AUTH_ORIGIN,
    )
    expect(approvedStatus).toBe(204)

    await page.goto('http://localhost:3103/health')
    const rejected = await page.evaluate(async (authOrigin) => {
      try {
        await fetch(`${authOrigin}/api/auth/session`, { credentials: 'include' })
        return false
      } catch {
        return true
      }
    }, AUTH_ORIGIN)
    expect(rejected).toBe(true)

    const rawResponse = await request.get(`${AUTH_LOOPBACK_ORIGIN}/api/auth/session`, {
      headers: { Origin: 'http://localhost:3103' },
    })
    expect(rawResponse.headers()['access-control-allow-origin']).toBeUndefined()
  })

  test('P2 rate limits the eleventh fallback refresh and exposes Retry-After', async ({ page }) => {
    await testLogin(page)
    const results = await page.evaluate(
      async ({ authOrigin, headers }) => {
        const responses = []
        for (let index = 0; index < 11; index += 1) {
          const response = await fetch(`${authOrigin}/api/auth/token/refresh`, {
            credentials: 'include',
            headers,
            method: 'POST',
          })
          responses.push({
            retryAfter: response.headers.get('Retry-After'),
            status: response.status,
          })
        }
        return responses
      },
      { authOrigin: AUTH_ORIGIN, headers: AUTH_HEADERS },
    )

    expect(results.slice(0, 10).every((result) => result.status === 204)).toBe(true)
    expect(results[10]).toEqual({ retryAfter: '60', status: 429 })
  })
})
