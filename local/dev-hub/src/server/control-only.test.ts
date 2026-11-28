import assert from 'node:assert/strict'
import test from 'node:test'

import { createControlOnlyApp, type TControlIdentity } from './control-only.ts'

const identity: TControlIdentity = {
  repoRoot: '/checkout',
  apiOrigin: 'http://127.0.0.1:4312',
  instanceId: 'test-instance',
  role: 'secondary',
  mode: 'control-only',
  apiVersion: 1,
}
const request = (path: string, method = 'GET', headers: Record<string, string> = {}) =>
  new Request(`http://127.0.0.1:4312${path}`, {
    method,
    headers: { host: '127.0.0.1:4312', ...headers },
  })

test('control-only permits identity and a static snapshot without primary URLs', async () => {
  const app = createControlOnlyApp(identity, () => {})
  assert.deepEqual(await (await app.fetch(request('/api/identity'))).json(), identity)
  const snapshot = (await (await app.fetch(request('/api/services'))).json()) as {
    mode: string
    services: Array<{
      port: number | null
      portlessUrl: string | null
      status: string
      canStart: boolean
    }>
  }
  assert.equal(snapshot.mode, 'control-only')
  assert.ok(snapshot.services.length > 0)
  assert.ok(
    snapshot.services.every(
      (item) =>
        item.port === null &&
        item.portlessUrl === null &&
        item.status === 'unavailable' &&
        !item.canStart,
    ),
  )
})

test('control-only rejects every unlisted API and mismatched shutdown identity', async () => {
  let stopped = false
  const app = createControlOnlyApp(identity, () => {
    stopped = true
  })
  for (const [method, route] of [
    ['POST', '/api/environment/ensure'],
    ['POST', '/api/services/dash/start'],
    ['GET', '/api/services/dash/config'],
    ['GET', '/api/events'],
    ['POST', '/api/services/dash/environment'],
  ] as const) {
    assert.equal((await app.fetch(request(route, method))).status, 403)
  }
  assert.equal(
    (await app.fetch(request('/api/identity', 'GET', { origin: 'http://evil.example' }))).status,
    403,
  )
  assert.equal(
    (await app.fetch(request('/api/shutdown', 'POST', { 'x-groupher-instance-id': 'old' }))).status,
    409,
  )
  assert.equal(stopped, false)
  assert.equal(
    (
      await app.fetch(
        request('/api/shutdown', 'POST', { 'x-groupher-instance-id': identity.instanceId }),
      )
    ).status,
    200,
  )
  await Promise.resolve()
  assert.equal(stopped, true)
})
