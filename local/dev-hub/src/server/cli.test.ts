import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import test from 'node:test'

import { runHubCommand as run } from './cli.ts'
import { REPO_ROOT } from './services.ts'
import { embedPageIdentity } from './page-identity.ts'

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

test('identity reports only a verified registered instance without starting services', async () => {
  const route = {
    origin: 'http://127.0.0.1:4312',
    instanceId: 'instance-a',
    mode: 'full' as const,
    role: 'primary' as const,
  }
  const identity = {
    repoRoot: REPO_ROOT,
    apiOrigin: route.origin,
    instanceId: route.instanceId,
    mode: route.mode,
    role: route.role,
    apiVersion: 1,
  }
  const calls: string[] = []
  const request: typeof fetch = async (input) => {
    calls.push(new URL(String(input)).pathname)
    return Response.json(identity)
  }
  assert.deepEqual(await run(['identity'], request, undefined, async () => route), identity)
  assert.deepEqual(calls, ['/api/identity'])
  const pageRequest: typeof fetch = async (input) =>
    new URL(String(input)).pathname === '/api/identity'
      ? Response.json(identity)
      : new Response(embedPageIdentity('<head></head>', identity), {
          headers: { 'content-type': 'text/html' },
        })
  assert.deepEqual(
    await run(['identity', '--page'], pageRequest, undefined, async () => route),
    identity,
  )
  const wrongPage: typeof fetch = async (input) =>
    new URL(String(input)).pathname === '/api/identity'
      ? Response.json(identity)
      : new Response(
          embedPageIdentity('<head></head>', { ...identity, instanceId: 'replacement' }),
          { headers: { 'content-type': 'text/html' } },
        )
  await assert.rejects(
    run(['identity', '--page'], wrongPage, undefined, async () => route),
    /page identity does not match/,
  )
  await assert.rejects(
    run(
      ['identity'],
      async () => Response.json({ ...identity, instanceId: 'replacement' }),
      undefined,
      async () => route,
    ),
    /does not match/,
  )
  await assert.rejects(runHubCommand(['identity'], fixture().request), /Legacy Hub identity/)
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
