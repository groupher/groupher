import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { TPublicService } from '@shared/contracts'

import { buildServiceViewModel } from './service-view-model'

const service = (
  id: string,
  status: TPublicService['status'],
  dependencies: Partial<TPublicService['startPolicy']> = {},
): TPublicService => ({
  id,
  name: id,
  description: '',
  group: 'backend',
  monogram: id.slice(0, 2),
  technologies: null,
  port: null,
  url: null,
  appUrl: null,
  portlessName: null,
  portlessUrl: null,
  portlessAppUrl: null,
  status,
  pid: null,
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
    defaultMode: 'chain',
    optionalDependencies: dependencies.optionalDependencies || [],
    requiredDependencies: dependencies.requiredDependencies || [],
  },
})

describe('buildServiceViewModel', () => {
  it('marks required dependency issues before optional dependency issues', () => {
    const model = buildServiceViewModel([
      service('gateway', 'running', {
        optionalDependencies: ['assets'],
        requiredDependencies: ['phoenix'],
      }),
      service('phoenix', 'stopped'),
      service('assets', 'stopped'),
    ])

    assert.deepEqual(model.dependencyStateByServiceId.get('gateway'), {
      hasOptionalDependencyIssue: false,
      hasRequiredDependencyIssue: true,
      hasStartedRequiredDependencies: false,
    })
  })

  it('marks optional issues only after required dependencies are started', () => {
    const model = buildServiceViewModel([
      service('gateway', 'running', {
        optionalDependencies: ['assets'],
        requiredDependencies: ['phoenix'],
      }),
      service('phoenix', 'external'),
      service('assets', 'unavailable'),
    ])

    assert.deepEqual(model.dependencyStateByServiceId.get('gateway'), {
      hasOptionalDependencyIssue: true,
      hasRequiredDependencyIssue: false,
      hasStartedRequiredDependencies: true,
    })
  })
})
