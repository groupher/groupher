import type { IncomingMessage } from 'node:http'

import { describe, expect, it } from 'vitest'

import { SITE } from './routing'
import { buildUpgradeHeaderLines, buildUpgradeTargetUrl } from './upgrade'

const makeRequest = (overrides: Partial<IncomingMessage> = {}): IncomingMessage =>
  ({
    method: 'GET',
    url: '/__dash_hmr?id=dev',
    httpVersion: '1.1',
    headers: {
      connection: 'Upgrade',
      host: 'dash.groupher.localhost',
      upgrade: 'websocket',
    },
    ...overrides,
  }) as IncomingMessage

describe('dev-gateway/upgrade', () => {
  it('routes Dash Vite websocket upgrades to Dash', () => {
    const targetUrl = buildUpgradeTargetUrl(makeRequest())

    expect(targetUrl.origin).toBe(new URL(SITE.DASH).origin)
    expect(targetUrl.pathname).toBe('/__dash_hmr')
    expect(targetUrl.search).toBe('?id=dev')
  })

  it('uses the forwarded host when Portless forwards an upgrade', () => {
    const targetUrl = buildUpgradeTargetUrl(
      makeRequest({
        headers: {
          connection: 'Upgrade',
          host: '127.0.0.1:3003',
          upgrade: 'websocket',
          'x-forwarded-host': 'dash.groupher.localhost',
        },
      }),
    )

    expect(targetUrl.origin).toBe(new URL(SITE.DASH).origin)
    expect(targetUrl.pathname).toBe('/__dash_hmr')
  })

  it('routes Apply and Landing Vite websocket paths on the public local host', () => {
    const apply = buildUpgradeTargetUrl(
      makeRequest({
        url: '/__apply_hmr?token=apply',
        headers: {
          connection: 'Upgrade',
          host: 'groupher.localhost',
          upgrade: 'websocket',
        },
      }),
    )
    const landing = buildUpgradeTargetUrl(
      makeRequest({
        url: '/__landing_hmr?token=landing',
        headers: {
          connection: 'Upgrade',
          host: 'groupher.localhost',
          upgrade: 'websocket',
        },
      }),
    )

    expect(apply.origin).toBe(new URL(SITE.APPLY).origin)
    expect(landing.origin).toBe(new URL(SITE.LANDING).origin)
  })

  it('rewrites the upstream Host header without losing websocket headers', () => {
    const lines = buildUpgradeHeaderLines(
      {
        connection: 'Upgrade',
        host: 'dash.groupher.localhost',
        'sec-websocket-key': 'abc',
        upgrade: 'websocket',
      },
      new URL('http://127.0.0.1:3005/__dash_hmr'),
    )

    expect(lines).toContain('host: 127.0.0.1:3005')
    expect(lines).toContain('connection: Upgrade')
    expect(lines).toContain('upgrade: websocket')
    expect(lines).toContain('sec-websocket-key: abc')
    expect(lines).toContain('x-forwarded-host: dash.groupher.localhost')
  })
})
