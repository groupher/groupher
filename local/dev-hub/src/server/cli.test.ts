import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import test from 'node:test'

import { runHubCommand as run } from './cli.ts'
import { REPO_ROOT } from './services.ts'

const runHubCommand = (args: string[], request: typeof fetch) =>
  run(args, request, undefined, async () => ({
    origin: 'http://127.0.0.1:4310',
    instanceId: null,
    mode: 'legacy',
    role: 'primary',
  }))

function fixture(repoRoot = REPO_ROOT) {
  const calls: Array<{ path: string; body: unknown }> = []
  const request: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null })
    if (path === '/api/identity') return Response.json({ repoRoot })
    if (path === '/api/services')
      return Response.json({
        services: [
          {
            id: 'dash',
            status: 'running',
            portlessAppUrl: 'https://dash.groupher.localhost/home/overview',
          },
        ],
      })
    return Response.json({ ready: true })
  }
  return { calls, request }
}

test('start uses the existing Hub API and preserves its default dependency mode', async () => {
  const { calls, request } = fixture()
  await runHubCommand(['start', 'dash'], request)
  assert.deepEqual(calls.at(-1), { path: '/api/services/dash/start', body: {} })
})

test('a cold start chain has time beyond the Phoenix readiness window', async (t) => {
  const timeouts: number[] = []
  const realTimeout = AbortSignal.timeout.bind(AbortSignal)
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    timeouts.push(milliseconds)
    return realTimeout(milliseconds)
  })
  const { request } = fixture()
  await runHubCommand(['start', 'dash'], request)
  assert.ok(timeouts.includes(240_000))
  assert.ok(timeouts.includes(5_000))
})

test('a Hub from another worktree cannot be controlled', async () => {
  const { calls, request } = fixture(tmpdir())
  await assert.rejects(runHubCommand(['restart', 'dash'], request), /another worktree/)
  assert.equal(calls.length, 1)
})

test('URL lookup rechecks the environment and returns only the canonical URL', async () => {
  const { calls, request } = fixture()
  assert.equal(
    await runHubCommand(['url', 'dash'], request),
    'https://dash.groupher.localhost/home/overview',
  )
  assert.equal(calls.at(-1)?.path, '/api/environment/ensure')
})

test('Hub outage does not silently launch a replacement server', async () => {
  const request: typeof fetch = async () => {
    throw new Error('connection refused')
  }
  await assert.rejects(runHubCommand(['start', 'dash'], request), /Start it with make dev/)
})

test('an old Hub SPA fallback is reported as an outdated API', async () => {
  const request: typeof fetch = async () =>
    new Response('<!doctype html>', {
      headers: { 'Content-Type': 'text/html' },
    })
  await assert.rejects(runHubCommand(['status'], request), /Restart the existing Hub/)
})

test('invalid modes and unknown services do not reach process-control endpoints', async () => {
  const { calls, request } = fixture()
  await assert.rejects(runHubCommand(['start', 'dash', '3103'], request), /Usage:/)
  assert.equal(calls.length, 0)
  await assert.rejects(runHubCommand(['start', 'unknown'], request), /Unknown Dev Hub service/)
  assert.ok(calls.every(({ path }) => !path.endsWith('/start')))
})
