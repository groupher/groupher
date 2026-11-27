import assert from 'node:assert/strict'
import test from 'node:test'

import {
  connectHub,
  controlService,
  createHubIdentityGuard,
  saveServiceEnvironment,
} from './hub-client.ts'

test('mutations bind to the identity observed immediately before the request', async () => {
  const original = globalThis.fetch
  const calls: Array<{ url: string; headers: Headers }> = []
  let identity = { instanceId: 'instance-a', apiVersion: 1, repoRoot: '/checkout/a' }
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, headers: new Headers(init?.headers) })
    if (url === '/api/identity') return Response.json(identity)
    return Response.json({ service: { id: 'dash' }, changes: {} })
  }
  try {
    await controlService('dash', 'restart')
    await saveServiceEnvironment('dash', { PORT: '3100' })
    assert.deepEqual(
      calls.map((call) => call.url),
      [
        '/api/identity',
        '/api/identity',
        '/api/services/dash/restart',
        '/api/identity',
        '/api/services/dash/environment',
      ],
    )
    assert.equal(calls[2].headers.get('X-Groupher-Instance-Id'), 'instance-a')
    assert.equal(calls[4].headers.get('X-Groupher-Instance-Id'), 'instance-a')
    identity = { instanceId: 'instance-b', apiVersion: 1, repoRoot: '/checkout/b' }
    await assert.rejects(controlService('dash', 'stop'), /instance changed/)
    assert.equal(calls.at(-1)?.url, '/api/identity')
  } finally {
    globalThis.fetch = original
  }
})

test('a page cannot control a replacement Hub on the same port', async () => {
  let identity = { instanceId: 'instance-a', apiVersion: 1, repoRoot: '/checkout/a' }
  const guard = createHubIdentityGuard(async () => Response.json(identity))
  await guard.initialize()
  assert.deepEqual(await guard.mutationHeaders(), { 'X-Groupher-Instance-Id': 'instance-a' })
  identity = { instanceId: 'instance-b', apiVersion: 1, repoRoot: '/checkout/b' }
  await assert.rejects(guard.mutationHeaders(), /instance changed/)
  identity = { instanceId: 'instance-a', apiVersion: 1, repoRoot: '/checkout/b' }
  await assert.rejects(guard.mutationHeaders(), /instance changed/)
})

test('a legacy Hub without an instance identity remains read-only', async () => {
  const guard = createHubIdentityGuard(async () =>
    Response.json({ repoRoot: '/checkout/a', apiOrigin: 'http://127.0.0.1:4310' }),
  )
  await guard.initialize()
  await assert.rejects(guard.mutationHeaders(), /read-only/)
})

test('incomplete new-protocol identity blocks mutation', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json({ apiVersion: 1 })
  }
  try {
    await assert.rejects(controlService('dash', 'stop'), /invalid instance identity/)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = original
  }
})

test('reconnecting to a different instance leaves service controls disconnected', async () => {
  const originalFetch = globalThis.fetch
  const originalEventSource = globalThis.EventSource
  let identity = { instanceId: 'instance-a', apiVersion: 1, repoRoot: '/checkout/a' }
  let source: EventTarget | undefined
  class FakeEventSource extends EventTarget {
    constructor() {
      super()
      source = this
    }
    close() {}
  }
  globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
  globalThis.fetch = async () => Response.json(identity)
  const connected: boolean[] = []
  const errors: string[] = []
  const disconnect = connectHub({
    onSnapshot: () => {},
    onStatus: () => {},
    onGit: () => {},
    onMetrics: () => {},
    onMetricNotices: () => {},
    onConnectionChange: (value) => connected.push(value),
    onIdentityError: (error) => errors.push(error),
  })
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
  try {
    source?.dispatchEvent(new Event('open'))
    await flush()
    assert.deepEqual(connected, [true])
    source?.dispatchEvent(new Event('error'))
    identity = { instanceId: 'instance-b', apiVersion: 1, repoRoot: '/checkout/b' }
    source?.dispatchEvent(new Event('open'))
    await flush()
    assert.deepEqual(connected, [true, false, false])
    assert.match(errors[0], /instance changed/)
  } finally {
    disconnect()
    globalThis.fetch = originalFetch
    globalThis.EventSource = originalEventSource
  }
})
