/**
 * Runs the MentionsGraph browser acceptance slice through actual Community routes.
 *
 *   Playwright CLI -> Community router/hosts -> real QueryClient -> controlled HTTP responses
 *
 * Run with playwright-cli run-code --filename. This checks UI transport and cancellation;
 * Phoenix permissions and persistence have separate backend acceptance tests.
 */
async function checkMentionsGraphHost(page) {
  const origin = 'http://127.0.0.1:3191'
  const requests = []
  const failures = []
  const checks = []
  let holdGraph = false
  let holdActivity = false
  let releaseGraph = () => {}
  let releaseActivity = () => {}
  const verify = (condition, name) => {
    if (!condition) throw new Error(name)
    checks.push(name)
  }
  const waitFor = async (condition) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await condition()) return
      await page.waitForTimeout(50)
    }
    throw new Error(
      'Request observation timed out: ' +
        JSON.stringify({
          checks,
          requests: requests.map((r) => ({ operation: r.operation, variables: r.variables })),
        }),
    )
  }
  await page.addInitScript(() => {
    window.__mentionsNativeAborts = []
    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      try {
        return await nativeFetch(input, init)
      } catch (error) {
        if (init?.signal?.aborted && error.name === 'AbortError') {
          window.__mentionsNativeAborts.push(String(init.body || ''))
        }
        throw error
      }
    }
  })
  page.on('requestfailed', (request) => failures.push(request.postData() || ''))
  await page.unroute('**/api/graphql')
  await page.route('**/api/graphql', async (route) => {
    const input = route.request().postDataJSON()
    const operation = /\bquery\s+(\w+)/.exec(input.query)?.[1] || 'anonymous'
    requests.push({ operation, variables: input.variables })
    if (operation === 'MentionsGraphPage') {
      if (holdGraph)
        await new Promise((resolve) => {
          releaseGraph = resolve
        })
      const { community, focus } = input.variables
      const id = `${community}:${focus.type}:${focus.articleInnerId}`
      const node = {
        id,
        type: focus.type,
        status: 'READABLE',
        title: `HOST:${id}`,
        url: `/${community}/${focus.type.toLowerCase()}/${focus.articleInnerId}`,
        locator: focus,
        canOpen: true,
      }
      try {
        await route.fulfill({
          json: {
            data: {
              mentionsGraph: {
                revision: 'host-revision-1',
                nodes: [node],
                edges: [],
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        })
      } catch {
        /* An aborted browser request has no response receiver. */
      }
      return
    }
    if (operation === 'MentionsGraphRevision') {
      await route.fulfill({ json: { data: { mentionsGraphRevision: 'host-revision-1' } } })
      return
    }
    if (operation === 'ArticleLogsPage') {
      if (holdActivity)
        await new Promise((resolve) => {
          releaseActivity = resolve
        })
      try {
        await route.fulfill({
          json: {
            data: {
              articleLogs: {
                entries: [],
                pageInfo: { __typename: 'CursorPageInfo', endCursor: null, hasNextPage: false },
              },
            },
          },
        })
      } catch {
        /* Expected when the Activity tab is removed. */
      }
      return
    }
    const response = await route.fetch({ url: 'http://127.0.0.1:4191/graphql' })
    await route.fulfill({ response })
  })
  const graphCount = () => requests.filter((r) => r.operation === 'MentionsGraphPage').length
  const activityCount = () => requests.filter((r) => r.operation === 'ArticleLogsPage').length
  const footer = page.locator('#article-footer')
  const tab = (name) => footer.getByText(name, { exact: true })

  for (const thread of ['post', 'blog', 'changelog', 'doc']) {
    const before = graphCount()
    const beforeActivity = activityCount()
    await page.goto(`${origin}/home/${thread}/1${thread === 'doc' ? '/start' : ''}`)
    await footer.waitFor({ state: 'visible' })
    await waitFor(() => activityCount() > beforeActivity)
    verify(graphCount() === before, `${thread}: inactive Mentions made zero page requests`)
    await tab('Mentions').click()
    await waitFor(() => graphCount() === before + 1)
    await footer.getByRole('img', { name: 'Directed mention relationships' }).waitFor()
    const last = requests.filter((r) => r.operation === 'MentionsGraphPage').at(-1)
    verify(
      last.variables.community === 'home' &&
        last.variables.focus.type === thread.toUpperCase() &&
        last.variables.focus.articleInnerId === '1' &&
        last.variables.after == null,
      `${thread}: route passed its canonical focus and first page`,
    )
    await tab('Members').click()
    verify(
      (await footer.getByRole('img', { name: 'Directed mention relationships' }).count()) === 0,
      `${thread}: switching tabs removed the graph`,
    )
  }

  // Same Article IDs in separate routes must retain independent graph cache entries.
  const beforeRouteActivity = activityCount()
  await page.goto(`${origin}/home/post/2`)
  await waitFor(() => activityCount() > beforeRouteActivity)
  await footer.waitFor({ state: 'visible' })
  const beforeOther = graphCount()
  await tab('Mentions').click()
  await waitFor(() => graphCount() === beforeOther + 1)
  verify(
    requests.filter((r) => r.operation === 'MentionsGraphPage').at(-1).variables.focus
      .articleInnerId === '2',
    'route change: graph cache did not reuse Article 1 as Article 2',
  )

  // A real browser fetch must be aborted when its only tab observer goes away.
  holdGraph = true
  const beforeHold = graphCount()
  await page.evaluate(() =>
    window.dispatchEvent(new Event('groupher:mentions-graph-content-change')),
  )
  await waitFor(() => graphCount() > beforeHold)
  await tab('Members').click()
  releaseGraph()
  await waitFor(() =>
    page.evaluate(() =>
      window.__mentionsNativeAborts.some((body) => body.includes('query MentionsGraphPage')),
    ),
  )
  verify(true, 'tab switch: browser aborted the in-flight GraphQL graph request')
  holdGraph = false

  const graphAbortCount = await page.evaluate(
    () =>
      window.__mentionsNativeAborts.filter((body) => body.includes('query MentionsGraphPage'))
        .length,
  )
  holdActivity = true
  const beforeActivity = activityCount()
  await page.goto(`${origin}/home/post/3`)
  await footer.waitFor({ state: 'visible' })
  await waitFor(() => activityCount() > beforeActivity)
  await tab('Members').click()
  releaseActivity()
  await waitFor(() =>
    page.evaluate(() =>
      window.__mentionsNativeAborts.some((body) => body.includes('query ArticleLogsPage')),
    ),
  )
  verify(true, 'tab switch: browser aborted the in-flight Activity request')
  holdActivity = false
  const activityAbortCount = await page.evaluate(
    () =>
      window.__mentionsNativeAborts.filter((body) => body.includes('query ArticleLogsPage')).length,
  )

  const beforeDrawer = graphCount()
  await page.goto(`${origin}/home/post`)
  const preview = page.getByRole('link', { name: 'Mock Post #1', exact: true }).first()
  await preview.waitFor()
  await page.waitForLoadState('networkidle')
  await preview.click()
  await footer.waitFor({ state: 'visible' })
  verify(
    (await page.locator('[data-drawer-scroll-container]').count()) > 0,
    'Post preview: the real masked route mounted a drawer',
  )
  verify(graphCount() === beforeDrawer, 'Post preview: inactive Mentions made zero page requests')
  await tab('Mentions').click()
  await waitFor(() => graphCount() === beforeDrawer + 1)
  verify(
    requests.filter((r) => r.operation === 'MentionsGraphPage').at(-1).variables.focus.type ===
      'POST',
    'Post preview: Mentions uses the drawer Article locator',
  )
  await page.goBack()
  await footer.waitFor({ state: 'detached' })
  verify(true, 'Post preview: browser back removed the drawer Footer')

  const beforeTicketGraph = graphCount()
  const beforeTicketActivity = activityCount()
  await page.goto(`${origin}/home/ticket/71`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Mentions', exact: true }).waitFor()
  verify(
    graphCount() === beforeTicketGraph && activityCount() === beforeTicketActivity,
    'Ticket: Mentions starts closed and does not request Article Activity',
  )
  await page.getByRole('button', { name: 'Mentions', exact: true }).click()
  await waitFor(() => graphCount() === beforeTicketGraph + 1)
  const ticketRequest = requests.filter((r) => r.operation === 'MentionsGraphPage').at(-1)
  verify(
    ticketRequest.variables.focus.type === 'TICKET' &&
      ticketRequest.variables.focus.articleInnerId === '71',
    'Ticket: opening Mentions sends the canonical Ticket locator',
  )
  verify(
    activityCount() === beforeTicketActivity,
    'Ticket: opening Mentions never requests Article Activity',
  )
  await page.getByRole('button', { name: 'Mentions', exact: true }).click()
  verify(
    (await page.getByRole('img', { name: 'Directed mention relationships' }).count()) === 0,
    'Ticket: closing Mentions unmounts the graph',
  )

  return {
    status: 'passed',
    checks,
    graphRequests: graphCount(),
    activityRequests: activityCount(),
    graphFetchAborted: graphAbortCount > 0,
    activityFetchAborted: activityAbortCount > 0,
  }
}
