import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    'public-origin': { type: 'string' },
    'internal-origin': { type: 'string' },
    fixtures: { type: 'string' },
    'auth-file': { type: 'string' },
    report: { type: 'string' },
    disabled: { type: 'boolean', default: false },
  },
})

for (const key of ['public-origin', 'internal-origin', 'fixtures']) {
  assert(values[key], `--${key} is required`)
}

const fixtures = JSON.parse(readFileSync(values.fixtures, 'utf8'))
const publicOrigin = new URL(values['public-origin']).origin
const internalOrigin = new URL(values['internal-origin']).origin
const results = []

const request = async (origin, path, init) => {
  const started = performance.now()
  const response = await fetch(origin + path, {
    signal: AbortSignal.timeout(45_000),
    ...init,
  })
  const body = await response.text()
  return { response, body, durationMs: Math.round(performance.now() - started) }
}

const check = async (name, verify) => {
  try {
    const detail = await verify()
    const result = { name, passed: true, ...detail }
    results.push(result)
    console.log(JSON.stringify(result))
  } catch (error) {
    const result = { name, passed: false, error: error.message }
    results.push(result)
    console.log(JSON.stringify(result))
  }
}

const paths = fixtures.articles.map(
  (article) => `/${fixtures.community}/${article.thread}/${article.inner_id}.md`,
)
paths.push(
  ...['feed.xml', 'feed.atom', 'feed.json', 'doc/feed.xml', 'llms.txt', 'sitemap.xml'].map(
    (path) => `/${fixtures.community}/${path}`,
  ),
)

for (const path of paths) {
  await check(`public ${path}`, async () => {
    const { response, body, durationMs } = await request(publicOrigin, path)
    assert.equal(response.status, values.disabled ? 503 : 200)

    if (values.disabled) {
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('retry-after'), '60')
    } else {
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
      assert(body.length > 0)
      assert(response.headers.get('etag'))
      if (path.endsWith('.md')) {
        assert.match(response.headers.get('content-type') || '', /^text\/markdown/)
        assert.match(response.headers.get('link') || '', /rel="?canonical"?/)
      }
      if (path.endsWith('feed.json')) {
        assert.equal(JSON.parse(body).items.length, fixtures.articles.length)
      }
    }

    return {
      status: response.status,
      bytes: Buffer.byteLength(body),
      durationMs,
      colo: response.headers.get('cf-ray')?.split('-').at(-1),
    }
  })
}

if (!values.disabled) {
  await check('conditional Markdown returns empty 304', async () => {
    const path = paths[0]
    const initial = await request(publicOrigin, path)
    const { response, body } = await request(publicOrigin, path, {
      headers: { 'if-none-match': initial.response.headers.get('etag') },
    })
    assert.equal(response.status, 304)
    assert.equal(body, '')
    return { status: response.status }
  })
} else {
  await check('disabled output cannot return 304', async () => {
    const { response } = await request(publicOrigin, paths[0], {
      headers: { 'if-none-match': '*' },
    })
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    return { status: response.status }
  })
}

await check('default health', async () => {
  const { response, body } = await request(internalOrigin, '/health')
  assert.equal(response.status, 200)
  assert.equal(JSON.parse(body).status, 'ok')
  return { status: response.status }
})

for (const path of paths) {
  await check(`default rejects ${path}`, async () => {
    const { response } = await request(internalOrigin, path)
    assert.equal(response.status, 404)
    return { status: response.status }
  })
}

await check('default rejects unsigned invalidation', async () => {
  const { response } = await request(internalOrigin, '/internal/invalidate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ community: fixtures.community }),
  })
  assert.equal(response.status, 401)
  return { status: response.status }
})

if (values['auth-file']) {
  await check('default accepts Phoenix-signed invalidation', async () => {
    const auth = JSON.parse(readFileSync(values['auth-file'], 'utf8'))
    const tokenResponse = await fetch(auth.tokenEndpoint, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${auth.clientId}:${auth.clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        resource: auth.resource,
        scope: 'press:cache:invalidate',
      }),
      signal: AbortSignal.timeout(20_000),
    })
    assert.equal(tokenResponse.status, 200, 'Phoenix test credential must obtain a token')
    const token = await tokenResponse.json()
    const { response, body } = await request(internalOrigin, '/internal/invalidate', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ community: fixtures.community }),
    })
    assert.equal(response.status, 200)
    assert.equal(JSON.parse(body).ok, true)
    return { status: response.status }
  })
}

const report = {
  capturedAt: new Date().toISOString(),
  publicOrigin,
  internalOrigin,
  disabled: values.disabled,
  passed: results.every((result) => result.passed),
  results,
}
if (values.report) writeFileSync(values.report, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ passed: report.passed, checks: results.length }))
if (!report.passed) process.exitCode = 1
