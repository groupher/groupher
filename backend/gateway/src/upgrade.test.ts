import type { IncomingMessage } from 'node:http'

import { describe, expect, it } from 'vitest'

import { SITE } from './routing'
import { buildUpgradeHeaderLines, buildUpgradeTargetUrl } from './upgrade'

const makeRequest = (overrides: Partial<IncomingMessage> = {}): IncomingMessage =>
  ({
    method: 'GET',
    url: '/_next/hmr?id=dev',
    httpVersion: '1.1',
    headers: {
      connection: 'Upgrade',
      host: 'dashboard.groupher.localhost',
      upgrade: 'websocket',
    },
    ...overrides,
  }) as IncomingMessage

describe('gateway/upgrade', () => {
  it('routes dashboard subdomain websocket upgrades to Dashboard upstream', () => {
    const targetUrl = buildUpgradeTargetUrl(makeRequest())

    expect(targetUrl.origin).toBe(new URL(SITE.DASHBOARD).origin)
    expect(targetUrl.pathname).toBe('/_next/hmr')
    expect(targetUrl.search).toBe('?id=dev')
  })

  it('uses the forwarded host when Portless forwards websocket upgrades to the listener', () => {
    const targetUrl = buildUpgradeTargetUrl(
      makeRequest({
        headers: {
          connection: 'Upgrade',
          host: '127.0.0.1:3003',
          upgrade: 'websocket',
          'x-forwarded-host': 'dashboard.groupher.localhost',
        },
      }),
    )

    expect(targetUrl.origin).toBe(new URL(SITE.DASHBOARD).origin)
    expect(targetUrl.pathname).toBe('/_next/hmr')
  })

  it('rewrites the upstream Host header without losing websocket headers', () => {
    const lines = buildUpgradeHeaderLines(
      {
        connection: 'Upgrade',
        host: 'dashboard.groupher.localhost',
        'sec-websocket-key': 'abc',
        upgrade: 'websocket',
      },
      new URL('http://127.0.0.1:3001/_next/hmr'),
    )

    expect(lines).toContain('host: 127.0.0.1:3001')
    expect(lines).toContain('connection: Upgrade')
    expect(lines).toContain('upgrade: websocket')
    expect(lines).toContain('sec-websocket-key: abc')
    expect(lines).toContain('x-forwarded-host: dashboard.groupher.localhost')
  })

  it('keeps the original forwarded host when a proxy has already provided one', () => {
    const lines = buildUpgradeHeaderLines(
      {
        connection: 'Upgrade',
        host: '127.0.0.1:3003',
        upgrade: 'websocket',
        'x-forwarded-host': 'dashboard.groupher.localhost',
      },
      new URL('http://127.0.0.1:3001/_next/hmr'),
    )

    expect(lines).toContain('host: 127.0.0.1:3001')
    expect(lines).toContain('x-forwarded-host: dashboard.groupher.localhost')
    expect(lines).not.toContain('x-forwarded-host: 127.0.0.1:3003')
  })
})
