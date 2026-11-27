import assert from 'node:assert/strict'
import test from 'node:test'

import { controlService, saveServiceEnvironment } from './hub-client.ts'

test('mutations bind to the identity observed immediately before the request', async () => {
  const original = globalThis.fetch
  const calls: Array<{ url: string; headers: Headers }> = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, headers: new Headers(init?.headers) })
    if (url === '/api/identity') return Response.json({ instanceId: 'instance-a', apiVersion: 1 })
    return Response.json({ service: { id: 'dash' }, changes: {} })
  }
  try {
    await controlService('dash', 'restart')
    await saveServiceEnvironment('dash', { PORT: '3100' })
    assert.deepEqual(
      calls.map((call) => call.url),
      [
        '/api/identity',
        '/api/services/dash/restart',
        '/api/identity',
        '/api/services/dash/environment',
      ],
    )
    assert.equal(calls[1].headers.get('X-Groupher-Instance-Id'), 'instance-a')
    assert.equal(calls[3].headers.get('X-Groupher-Instance-Id'), 'instance-a')
  } finally {
    globalThis.fetch = original
  }
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
