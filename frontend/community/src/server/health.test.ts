import { SERVICE_HEALTH_SERVICES } from '@groupher/contracts/health'
import { describe, expect, it } from 'vitest'

import { buildCommunityHealth } from './health'

describe('Community health.v1', () => {
  it('returns every required contract field with isolate uptime', () => {
    const response = buildCommunityHealth({
      environment: 'test',
      now: new Date('2026-08-22T00:00:00.000Z'),
      uptimeMs: 123,
      version: 'test-sha',
    })

    expect(response).toEqual({
      schemaVersion: 'health.v1',
      status: 'ok',
      service: 'community',
      version: 'test-sha',
      environment: 'test',
      timestamp: '2026-08-22T00:00:00.000Z',
      uptimeMs: 123,
      checks: [],
    })
    expect(SERVICE_HEALTH_SERVICES).toContain('community')
  })
})
