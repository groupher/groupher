import { expect, test } from '@playwright/test'

const MOCK_GRAPHQL_ORIGIN = `http://localhost:${process.env.MOCK_GRAPHQL_PORT ?? '4001'}`

const PROVIDER_HOSTS = [
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'www.clarity.ms',
  'scripts.clarity.ms',
  'plausible.io',
  'cdn.usefathom.com',
]

const SCRIPT_IDS = [
  'third-party-analytics-ga-loader',
  'third-party-analytics-ga-init',
  'third-party-analytics-gtm',
  'third-party-analytics-clarity',
  'third-party-analytics-plausible',
  'third-party-analytics-fathom',
]

const providerUrlPattern = new RegExp(`^https://(${PROVIDER_HOSTS.join('|').replaceAll('.', '\\.')})/`)

const setScenario = async (request, scenario: string): Promise<void> => {
  const response = await request.post(`${MOCK_GRAPHQL_ORIGIN}/__e2e/third-party-analytics`, {
    data: { scenario },
  })

  expect(response.ok()).toBe(true)
}

const recordProviderRequests = async (page) => {
  const requests: string[] = []

  await page.route(providerUrlPattern, async (route) => {
    requests.push(route.request().url())
    await route.fulfill({
      body: '',
      contentType: 'application/javascript',
      status: 200,
    })
  })

  return requests
}

const gotoPublicCommunity = async (page, community: string): Promise<void> => {
  await page.goto(`/${community}/about`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('link', { name: '讨论' })).toBeVisible()
  await expect(page.getByText('社区简介')).toBeVisible()
}

const expectNoThirdPartyScripts = async (page): Promise<void> => {
  for (const id of SCRIPT_IDS) {
    await expect(page.locator(`script#${id}`)).toHaveCount(0)
  }
}

test.describe.serial('third-party analytics scripts', () => {
  test('does not render scripts when no provider is loadable', async ({ page, request }) => {
    await setScenario(request, 'none')
    const providerRequests = await recordProviderRequests(page)

    await gotoPublicCommunity(page, 'home-analytics-none')

    await expectNoThirdPartyScripts(page)
    expect(providerRequests).toEqual([])
  })

  test('does not render scripts for disabled provider configs', async ({ page, request }) => {
    await setScenario(request, 'disabled')
    const providerRequests = await recordProviderRequests(page)

    await gotoPublicCommunity(page, 'home-analytics-disabled')

    await expectNoThirdPartyScripts(page)
    expect(providerRequests).toEqual([])
  })

  test('does not render scripts for invalid enabled provider configs', async ({ page, request }) => {
    await setScenario(request, 'invalid')
    const providerRequests = await recordProviderRequests(page)

    await gotoPublicCommunity(page, 'home-analytics-invalid')

    await expectNoThirdPartyScripts(page)
    expect(providerRequests).toEqual([])
  })

  test('renders only a valid enabled Google Analytics config', async ({ page, request }) => {
    await setScenario(request, 'ga')
    const providerRequests = await recordProviderRequests(page)

    await gotoPublicCommunity(page, 'home-analytics-ga')

    await expect(page.locator('script#third-party-analytics-ga-loader')).toHaveAttribute(
      'src',
      /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-E2E1234/,
    )
    await expect(page.locator('script#third-party-analytics-ga-init')).toHaveCount(1)
    await expect(page.locator('script#third-party-analytics-fathom')).toHaveCount(0)
    expect(providerRequests).toEqual([
      expect.stringMatching(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-E2E1234/),
    ])
  })

  test('renders each valid enabled provider once', async ({ page, request }) => {
    await setScenario(request, 'multiple')
    const providerRequests = await recordProviderRequests(page)

    await gotoPublicCommunity(page, 'home-analytics-multiple')

    await expect(page.locator('script#third-party-analytics-ga-loader')).toHaveCount(1)
    await expect(page.locator('script#third-party-analytics-ga-init')).toHaveCount(1)
    await expect(page.locator('script#third-party-analytics-fathom')).toHaveAttribute(
      'data-site',
      'FATHOME2E',
    )
    await expect(page.locator('script#third-party-analytics-fathom')).toHaveCount(1)

    expect(providerRequests).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-E2E1234/),
        expect.stringMatching(/https:\/\/cdn\.usefathom\.com\/script\.js/),
      ]),
    )
  })
})
