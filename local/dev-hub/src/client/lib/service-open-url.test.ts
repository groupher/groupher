import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { TPublicService, TServiceMetricsSnapshot } from '@shared/contracts'

import { getServiceOpenUrl } from './service-open-url'

const service = (overrides: Partial<TPublicService>): TPublicService => ({
  id: 'main',
  name: 'Main',
  description: '',
  group: 'frontend',
  monogram: 'MN',
  technologies: null,
  port: 3000,
  url: 'http://127.0.0.1:3000/health',
  appUrl: 'http://127.0.0.1:3000/home',
  portlessName: 'main',
  portlessUrl: 'https://main.groupher.localhost/health',
  portlessAppUrl: 'https://main.groupher.localhost/home',
  endpoints: [],
  status: 'running',
  pid: 123,
  startedAt: null,
  endedAt: null,
  exitCode: null,
  canStart: true,
  unavailableReason: null,
  metricThresholds: {
    browserBusyPercent: 80,
    browserHeapBytes: 512 * 1024 * 1024,
    serverCpuPercent: 80,
    serverRssBytes: 512 * 1024 * 1024,
  },
  startPolicy: {
    defaultMode: 'self',
    optionalDependencies: [],
    requiredDependencies: [],
  },
  ...overrides,
})

describe('getServiceOpenUrl', () => {
  it('opens landing through its Portless host by default', () => {
    assert.equal(
      getServiceOpenUrl(
        service({
          id: 'landing',
          name: 'Landing',
          appUrl: 'http://127.0.0.1:3002/',
          portlessAppUrl: 'https://landing.groupher.localhost/',
        }),
      ),
      'https://landing.groupher.localhost/',
    )
  })

  it('keeps portless as the default local app URL for other services', () => {
    assert.equal(getServiceOpenUrl(service({})), 'https://main.groupher.localhost/home')
  })

  it('prefers the active browser heartbeat URL when present', () => {
    const metrics: TServiceMetricsSnapshot = {
      serviceId: 'landing',
      server: null,
      browser: {
        at: Date.now(),
        pageId: 'page-1',
        url: 'https://landing.groupher.localhost/pricing',
        visibility: 'visible',
        heapBytes: 1,
        busyPercent: 0,
        heapCritical: false,
        busyCritical: false,
      },
      browserPageCount: 1,
    }

    assert.equal(
      getServiceOpenUrl(service({ id: 'landing' }), metrics),
      'https://landing.groupher.localhost/pricing',
    )
  })
})
