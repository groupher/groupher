/**
 * Checks stable Comment focus through Community -> BFF -> Phoenix -> persisted fixtures.
 *
 * Seed a fresh local test database with mentions_doc_comment_browser.exs, start Community
 * with E2E_AUTH_STACK=1 and its real Phoenix endpoint, then run this with Playwright CLI
 * run-code --filename. No response interception or mock GraphQL server is used.
 */
async function checkMentionsDocCommentJoint(page) {
  const origin = 'http://127.0.0.1:3197'
  const requests = []
  const errors = []
  const checks = []
  const verify = (condition, name) => {
    if (!condition) throw new Error(name)
    checks.push(name)
  }
  const waitFor = async (condition) => {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await condition()) return
      await page.waitForTimeout(50)
    }
    throw new Error('Joint acceptance timeout: ' + JSON.stringify({ checks, requests, errors }))
  }
  const observe = (request) => {
    if (!request.url().endsWith('/api/graphql') || request.method() !== 'POST') return
    const input = request.postDataJSON()
    const operation = /\bquery\s+(\w+)/.exec(input.query)?.[1]
    if (operation?.startsWith('MentionsGraph')) {
      requests.push({ operation, variables: input.variables })
    }
  }
  const observeResponse = async (response) => {
    if (!response.url().endsWith('/api/graphql')) return
    const query = response.request().postDataJSON()?.query || ''
    if (!/\bquery\s+MentionsGraph/.test(query)) return
    try {
      const result = await response.json()
      if (result.errors) errors.push(result.errors.map((error) => error.message))
    } catch {
      // A native cancelled fetch has no complete response body.
    }
  }
  const graphRequests = () => requests.filter((item) => item.operation === 'MentionsGraphPage')
  page.on('request', observe)
  page.on('response', observeResponse)
  await page.addInitScript(() => {
    window.__mentionsJointAborts = []
    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      try {
        return await nativeFetch(input, init)
      } catch (error) {
        if (init?.signal?.aborted && error.name === 'AbortError') {
          window.__mentionsJointAborts.push(String(init.body || ''))
        }
        throw error
      }
    }
  })
  try {
    await page.goto(`${origin}/home/doc/1/doc-8`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Mentions', exact: true }).waitFor()
    verify(requests.length === 0, 'Doc Activity mount does not prefetch graph or comment seeds')
    await page.getByRole('button', { name: 'Mentions', exact: true }).click()
    await waitFor(() => graphRequests().length > 0)
    verify(
      graphRequests()[0].variables.focus.type === 'DOC',
      'Doc tab starts with stable Doc focus',
    )
    await page.getByRole('button', { name: 'View comment mentions', exact: true }).click()
    const seed = page.getByRole('button', { name: 'Comment #1', exact: true })
    await seed.waitFor()
    verify(
      requests.some((item) => item.operation === 'MentionsGraphArticleComments'),
      'Doc comments are fetched from the actual seed endpoint',
    )
    await seed.click()
    await waitFor(() => graphRequests().some((item) => item.variables.focus.type === 'COMMENT'))
    await page.getByRole('button', { name: 'Back to article mentions', exact: true }).waitFor()
    const comment = graphRequests().find((item) => item.variables.focus.type === 'COMMENT')
    verify(
      comment.variables.focus.type === 'COMMENT' &&
        comment.variables.focus.articleInnerId === '1' &&
        comment.variables.focus.commentInnerId === '1' &&
        Object.keys(comment.variables.focus).every((key) =>
          ['type', 'articleInnerId', 'commentInnerId'].includes(key),
        ),
      'Doc Comment focus contains only stable parent Article and Comment IDs',
    )
    const section = page.getByRole('region', { name: 'Mentions', exact: true })
    await waitFor(async () => (await section.locator('svg line').count()) === 1)
    verify(
      (await section.locator('a[href*="#comment-1"]').count()) > 0,
      'Doc Comment node links to canonical Doc with Comment anchor',
    )
    await page.getByRole('button', { name: 'Back to article mentions', exact: true }).click()
    await waitFor(
      async () =>
        (await page
          .getByRole('button', { name: 'Back to article mentions', exact: true })
          .count()) === 0,
    )
    verify(await section.isVisible(), 'Return to Doc preserves Mentions tab')
    verify(
      new URL(page.url()).pathname === '/home/doc/1/doc-8',
      'Focus switch preserves canonical Doc route',
    )

    // A new document gives this cancellation check a cold query cache.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Mentions', exact: true }).click()
    await page.getByRole('button', { name: 'View comment mentions', exact: true }).click()
    await seed.waitFor()
    const cdp = await page.context().newCDPSession(page)
    try {
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 1500,
        downloadThroughput: -1,
        uploadThroughput: -1,
      })
      const before = graphRequests().length
      await seed.click()
      await waitFor(() => graphRequests().length > before)
      await page.getByRole('button', { name: 'Back to article mentions', exact: true }).click()
      await waitFor(() =>
        page.evaluate(() =>
          window.__mentionsJointAborts.some((body) => body.includes('MentionsGraphPage')),
        ),
      )
      verify(true, 'Returning from in-flight Doc Comment focus aborts native graph fetch')
    } finally {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      })
      await cdp.detach()
    }
    await page.goto(`${origin}/home/post/3`)
    await page.getByText('Joint browser reference', { exact: false }).waitFor()
    const root = page.locator('#comment-1')
    await root.getByRole('button', { name: 'Mentions', exact: true }).waitFor()
    const beforePost = graphRequests().length
    await root.getByRole('button', { name: 'Mentions', exact: true }).click()
    await waitFor(() => graphRequests().length > beforePost)
    const postFocus = graphRequests()[beforePost].variables.focus
    verify(
      postFocus.type === 'COMMENT' &&
        postFocus.articleInnerId === '3' &&
        postFocus.commentInnerId === '1',
      'Actual Post Comment callback opens Comment graph directly',
    )
    await page.getByRole('button', { name: 'Back to article mentions', exact: true }).click()
    await waitFor(() => graphRequests().some((item) => item.variables.focus.type === 'POST'))
    verify(await section.isVisible(), 'Return from Post Comment preserves Mentions tab')
    verify(
      requests.every((item) => !JSON.stringify(item.variables).includes('branch')),
      'All graph, revision and seed requests omit branch identity',
    )
    verify(
      errors.length === 0,
      'MentionsGraph requests returned no GraphQL errors: ' + JSON.stringify(errors),
    )
    return {
      environment: 'dedicated local persisted test database',
      transport: 'real Community BFF and Phoenix; no intercepted responses',
      checks,
      requests,
      errors,
    }
  } finally {
    page.off('request', observe)
    page.off('response', observeResponse)
  }
}
