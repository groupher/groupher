import assert from 'node:assert/strict'
import test from 'node:test'

import config from './playwright.config.ts'

test('Dash readiness uses the loopback health endpoint while browser tests keep the product host', () => {
  const servers = Array.isArray(config.webServer) ? config.webServer : [config.webServer]
  const port = process.env.DASH_E2E_PORT ?? '3103'
  assert.ok(servers.some((server) => server?.url === `http://127.0.0.1:${port}/health`))
  assert.equal(config.use?.baseURL, `http://dash.groupher.localhost:${port}`)
})
