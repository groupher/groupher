import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBrowserOriginsByService,
  collectBrowserOrigins,
  isBrowserMetricOriginAllowed,
} from './browser-origins.ts'
import { SERVICE_DEFINITIONS } from './services.ts'

const originsByService = buildBrowserOriginsByService(SERVICE_DEFINITIONS)

test('browser metrics accept raw-port and Portless origins for browser-facing services', () => {
  assert.deepEqual(Array.from(originsByService.get('dash') || []).sort(), [
    'http://127.0.0.1:3005',
    'http://localhost:3005',
    'https://dash.groupher.localhost',
  ])

  const allOrigins = collectBrowserOrigins(originsByService)
  assert.equal(allOrigins.has('https://groupher.localhost'), true)
  assert.equal(allOrigins.has('https://dash.groupher.localhost'), true)
  assert.equal(allOrigins.has('https://auth.groupher.localhost'), true)
})

test('browser metric reports must match both the service and page origin', () => {
  assert.equal(
    isBrowserMetricOriginAllowed({
      originsByService,
      serviceId: 'dash',
      requestOrigin: 'https://dash.groupher.localhost',
      reportUrl: 'https://dash.groupher.localhost/home/overview',
    }),
    true,
  )

  assert.equal(
    isBrowserMetricOriginAllowed({
      originsByService,
      serviceId: 'dash',
      requestOrigin: 'https://dash.groupher.localhost',
      reportUrl: 'https://evil.example/home',
    }),
    false,
  )
})
