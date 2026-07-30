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
  assert.deepEqual(Array.from(originsByService.get('dashboard') || []).sort(), [
    'http://127.0.0.1:3001',
    'http://localhost:3001',
    'https://dashboard.groupher.localhost',
  ])

  const allOrigins = collectBrowserOrigins(originsByService)
  assert.equal(allOrigins.has('https://groupher.localhost'), true)
  assert.equal(allOrigins.has('https://main.groupher.localhost'), true)
  assert.equal(allOrigins.has('https://dashboard.groupher.localhost'), true)
  assert.equal(allOrigins.has('https://auth.groupher.localhost'), true)
})

test('browser metric reports must match both the service and page origin', () => {
  assert.equal(
    isBrowserMetricOriginAllowed({
      originsByService,
      serviceId: 'dashboard',
      requestOrigin: 'https://dashboard.groupher.localhost',
      reportUrl: 'https://dashboard.groupher.localhost/home/dashboard',
    }),
    true,
  )

  assert.equal(
    isBrowserMetricOriginAllowed({
      originsByService,
      serviceId: 'main',
      requestOrigin: 'https://dashboard.groupher.localhost',
      reportUrl: 'https://dashboard.groupher.localhost/home/dashboard',
    }),
    false,
  )

  assert.equal(
    isBrowserMetricOriginAllowed({
      originsByService,
      serviceId: 'dashboard',
      requestOrigin: 'https://dashboard.groupher.localhost',
      reportUrl: 'https://evil.example/home/dashboard',
    }),
    false,
  )
})
