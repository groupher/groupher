import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildHubHostAllowlist,
  isAllowedHubHost,
  isAllowedInstanceMutation,
  isAllowedRequestOrigin,
} from './request-guards.ts'

test('Hub host allowlist follows the configured API and UI ports', () => {
  const hosts = buildHubHostAllowlist(4311, 4310)
  assert.equal(isAllowedHubHost('127.0.0.1:4311', hosts), true)
  assert.equal(isAllowedHubHost('localhost:4310', hosts), true)
  assert.equal(isAllowedHubHost('[::1]:4311', hosts), true)
  assert.equal(isAllowedHubHost('evil.example:4311', hosts), false)
  assert.equal(isAllowedHubHost('127.0.0.1:9999', hosts), false)
  assert.equal(isAllowedHubHost(undefined, hosts), false)
})

test('managed mutations require the current instance while legacy requests remain compatible', () => {
  assert.equal(isAllowedInstanceMutation('GET', 'new', undefined), true)
  assert.equal(isAllowedInstanceMutation('OPTIONS', 'new', undefined), true)
  assert.equal(isAllowedInstanceMutation('POST', 'new', 'old'), false)
  assert.equal(isAllowedInstanceMutation('PATCH', 'new', undefined), false)
  assert.equal(isAllowedInstanceMutation('POST', 'new', 'new'), true)
  assert.equal(isAllowedInstanceMutation('POST', undefined, undefined), true)
})

test('sensitive API origins reject foreign origins while CLI requests without Origin remain valid', () => {
  const origins = new Set(['http://127.0.0.1:4311', 'http://localhost:4310'])
  assert.equal(isAllowedRequestOrigin('http://127.0.0.1:4311', origins), true)
  assert.equal(isAllowedRequestOrigin('http://evil.example', origins), false)
  assert.equal(isAllowedRequestOrigin(undefined, origins), true)
  assert.equal(isAllowedRequestOrigin('http://localhost:4310/path', origins), false)
})
