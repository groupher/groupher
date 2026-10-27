import { describe, expect, it, vi } from 'vitest'

import { PROBES, checkAll, type ProbeBindings } from './probes'
import { nextState, type StatusRow } from './state'
import { statusPayload } from './view'

describe('frontend-only status probes', () => {
  it('never targets Fly, GraphQL, or an SSR content page', () => {
    expect(PROBES).toHaveLength(6)
    for (const probe of PROBES) {
      expect(probe.url).not.toMatch(/api\.groupher|graphql|graphiql|fly\.dev|\/home\/post/)
      expect(new URL(probe.url).pathname).toMatch(/^\/$|^\/health$/)
    }
  })

  it('checks only the allowlist and rejects a wrong health service', async () => {
    const requests: string[] = []
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requests.push(url)
      const probe = PROBES.find((candidate) => candidate.url === url)
      return new Response(
        probe?.service
          ? JSON.stringify({ schemaVersion: 'health.v1', status: 'ok', service: 'phoenix' })
          : '',
        { status: 200 },
      )
    }) as typeof fetch
    const bindings = Object.fromEntries(
      PROBES.map((probe) => [probe.binding, { fetch: fetcher }]),
    ) as ProbeBindings
    const results = await checkAll(bindings)
    expect(requests).toEqual(expect.arrayContaining(PROBES.map((probe) => probe.url)))
    expect(results.filter((result) => result.ok).map((result) => result.id)).toEqual(['landing'])
  })
})

describe('current status', () => {
  const row = (state: StatusRow['state'], streak: number): StatusRow => ({
    id: 'dash',
    state,
    streak,
    response_ms: 40,
    checked_at: '2026-10-27T00:00:00.000Z',
  })

  it('requires three failures and two successes to recover', () => {
    expect(nextState(row('up', 2), false)).toEqual({ state: 'degraded', streak: -1 })
    expect(nextState(row('degraded', -2), false)).toEqual({ state: 'down', streak: -3 })
    expect(nextState(row('down', -3), true)).toEqual({ state: 'degraded', streak: 1 })
    expect(nextState(row('degraded', 1), true)).toEqual({ state: 'up', streak: 2 })
  })

  it('shows unknown when monitoring stops', () => {
    const payload = statusPayload(
      new Map([['dash', row('up', 2)]]),
      new Date('2026-10-27T00:08:00.000Z'),
    )
    expect(payload.services.find((service) => service.id === 'dash')?.state).toBe('unknown')
  })
})
