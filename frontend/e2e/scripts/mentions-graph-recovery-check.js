/**
 * Checks bounded graph recovery on the real Community Post route and local API fixture.
 * Only the rejected GraphQL response and one stale cursor are injected.
 */
async function checkMentionsGraphRecovery(page) {
  const origin = 'http://127.0.0.1:3197'
  const postPath = '/home/post/3'
  const requests = []
  let mode = 'first'
  let initialAttempts = 0
  let staleCursors = 0
  let firstPages = 0

  await page.unroute('**/api/graphql')
  await page.route('**/api/graphql', async (route) => {
    const input = route.request().postDataJSON()
    const operation = /\bquery\s+(\w+)/.exec(input.query)?.[1]
    if (operation !== 'MentionsGraphPage') return route.continue()

    const hasCursor = Boolean(input.variables.after)
    requests.push({ mode, hasCursor })
    if (mode === 'first' && initialAttempts++ === 0) {
      return route.fulfill({
        json: { errors: [{ message: 'revision changed', extensions: { code: 4553 } }] },
      })
    }
    if (mode === 'cursor' && hasCursor) {
      staleCursors++
      return route.fulfill({
        json: { errors: [{ message: 'invalid cursor', extensions: { code: 4551 } }] },
      })
    }

    const response = await route.fetch({ url: 'http://127.0.0.1:4197/graphiql' })
    if (mode === 'cursor' && firstPages++ === 0) {
      const result = await response.json()
      if (!result.data?.mentionsGraph) {
        throw new Error('Real API returned no graph page')
      }
      const graph = result.data.mentionsGraph
      const source = graph.nodes.find(
        (node) => node.locator?.type === 'POST' && String(node.locator?.articleInnerId) === '3',
      )
      if (!source) throw new Error('Real API returned no focus node')
      graph.nodes.push({
        ...source,
        id: 'browser-target',
        title: 'Browser target',
        url: postPath,
      })
      graph.edges.push({
        id: 'browser-edge',
        from: source.id,
        to: 'browser-target',
        occurrencesCount: 1,
      })
      graph.hasNextPage = true
      graph.endCursor = 'stale-browser-cursor'
      return route.fulfill({ json: result })
    }
    return route.fulfill({ response })
  })

  const waitForCount = async (count) => {
    for (let i = 0; i < 100; i++) {
      if (requests.filter((request) => request.mode === mode).length >= count) return
      await page.waitForTimeout(50)
    }
    throw new Error(
      `Graph request count did not reach ${count}: ${JSON.stringify({ requests, initialAttempts, mode })}`,
    )
  }

  await page.goto(`${origin}${postPath}`)
  await page.waitForLoadState('networkidle')
  const footer = page.locator('#article-footer')
  await footer.waitFor({ state: 'visible' })
  await footer.getByText('Mentions', { exact: true }).click()
  await waitForCount(2)
  const graphStatus = page.getByRole('region', { name: 'Mentions' }).getByRole('status')
  await graphStatus.filter({ hasNotText: /loading/i }).waitFor()
  if (/loading|failed/i.test(await graphStatus.innerText())) {
    throw new Error(`First-page recovery did not settle: ${await graphStatus.innerText()}`)
  }
  if (
    initialAttempts !== 2 ||
    requests.filter((request) => request.mode === 'first').length !== 2
  ) {
    throw new Error('First-page revision race was not retried exactly once')
  }

  mode = 'cursor'
  firstPages = 0
  await page.goto(`${origin}${postPath}`)
  await page.waitForLoadState('networkidle')
  await footer.waitFor({ state: 'visible' })
  await footer.getByText('Mentions', { exact: true }).click()
  await page.getByRole('button', { name: /more/i }).waitFor()
  await page.getByRole('button', { name: /more/i }).click()
  await waitForCount(3)
  await graphStatus.filter({ hasNotText: /loading/i }).waitFor()
  if (/loading|failed/i.test(await graphStatus.innerText())) {
    throw new Error(`Cursor recovery did not settle: ${await graphStatus.innerText()}`)
  }
  if (
    staleCursors !== 1 ||
    requests.filter((request) => request.mode === 'cursor' && request.hasCursor).length !== 1 ||
    requests.filter((request) => request.mode === 'cursor' && !request.hasCursor).length !== 2
  ) {
    throw new Error('Stale cursor was replayed or graph did not restart once')
  }

  return {
    status: 'passed',
    postPath,
    requests,
    injectedRevisionFailures: 1,
    injectedStaleCursors: staleCursors,
  }
}
