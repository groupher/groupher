import assert from 'node:assert/strict'
import test from 'node:test'

import { checkRoutes, checkUsage, runGuard } from './free-guard.mjs'

const routes = [
  { pattern: 'groupher.com/*', script: 'edge-router', request_limit_fail_open: false },
  { pattern: 'www.groupher.com/*', script: 'edge-router', request_limit_fail_open: false },
  { pattern: 'auth.groupher.com/*', script: 'auth', request_limit_fail_open: false },
]

test('fails on removed routes, wrong owners, missing fail mode and new fail-open core routes', () => {
  assert.deepEqual(checkRoutes(routes), [])
  assert.equal(checkRoutes(routes.slice(1)).length, 1)
  assert.equal(checkRoutes([{ ...routes[0], script: 'other' }, ...routes.slice(1)]).length, 1)
  assert.equal(
    checkRoutes([{ ...routes[0], request_limit_fail_open: undefined }, ...routes.slice(1)]).length,
    1,
  )
  assert.equal(
    checkRoutes([
      ...routes,
      { pattern: 'talk.example.com/*', script: 'edge-router', request_limit_fail_open: true },
    ]).length,
    1,
  )
})

test('checks shared daily usage, error rate and CPU refusals independently', () => {
  const usage = checkUsage(
    [{ sum: { requests: 70000 } }],
    [
      { dimensions: { status: 'ok' }, sum: { requests: 99, errors: 0 } },
      { dimensions: { status: 'exceededCpu' }, sum: { requests: 1, errors: 1 } },
    ],
  )
  assert.equal(usage.failures.length, 3)
  assert.equal(usage.calls, 70000)
  assert.deepEqual(checkUsage([], []).failures, [])
})

test('API failures still execute public probes and cannot produce a green monitor', async () => {
  const called = []
  const result = await runGuard({
    token: 'test',
    fetcher: async (url) => {
      called.push(url)
      return new Response('', { status: 503 })
    },
  })
  assert.equal(called.length, 6)
  assert.equal(result.failures.length, 6)
})

test('route-only mode never fetches content or analytics', async () => {
  const called = []
  const result = await runGuard({
    token: 'test',
    routesOnly: true,
    fetcher: async (url) => {
      called.push(url)
      return Response.json({ success: true, result: routes })
    },
  })
  assert.deepEqual(result.failures, [])
  assert.equal(called.length, 1)
  assert.match(called[0], /workers\/routes$/)
})

test('GraphQL permission errors fail closed rather than reporting zero usage', async () => {
  const result = await runGuard({
    token: 'test',
    fetcher: async (url) => {
      if (url.endsWith('/workers/routes')) return Response.json({ success: true, result: routes })
      if (url.endsWith('/graphql')) return Response.json({ errors: [{ message: 'forbidden' }] })
      const service = url.includes('auth.')
        ? 'auth'
        : url.includes('press.')
          ? 'press'
          : 'edge-router'
      if (url.endsWith('/health')) return Response.json({ service, status: 'ok' })
      return new Response('', {
        status: url.includes('press.') ? 404 : 200,
        headers: { 'cache-control': 'no-store' },
      })
    },
  })
  assert.equal(result.failures.length, 1)
  assert.match(result.failures[0], /rejected/)
})
