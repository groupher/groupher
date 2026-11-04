import { decode } from '@auth/core/jwt'
import { getAuthSessionCookieName } from '@groupher/contracts/auth'
import { describe, expect, it, vi } from 'vitest'

import { readBrowserSession, useSecureCookies } from './auth'
import { redeemAcceptanceRequest } from './production-seed'

const env = {
  PRODUCTION_SEED_LOGIN_ENABLED: 'true',
  PRODUCTION_SEED_LOGIN_UNTIL: new Date(Date.now() + 600_000).toISOString(),
  NEXTAUTH_SECRET: 'local-acceptance-test-secret-at-least-32-bytes',
}
const credential = 'psl_' + 'a'.repeat(43)
const request = (changes: Record<string, string> = {}, body = JSON.stringify({ credential })) =>
  new Request('https://auth.groupher.com/api/auth/production-seed/redeem', {
    method: 'POST',
    headers: {
      origin: 'https://groupher.com',
      'X-Groupher-CSRF': '1',
      'content-type': 'application/json',
      ...changes,
    },
    body,
  })
const result = {
  accessToken: 'official-phoenix-token',
  accessExpiresAt: new Date(Date.now() + 300_000).toISOString(),
  browserSessionRef: 'bs_test',
  sessionAbsoluteExpiresAt: new Date(Date.now() + 600_000).toISOString(),
}
const allowed = (origin: string) => origin === 'https://groupher.com'

describe('temporary production acceptance Auth redemption', () => {
  it('is closed by default and rejects missing/expired deployment windows', async () => {
    const redeem = vi.fn()
    for (const overrides of [
      { PRODUCTION_SEED_LOGIN_ENABLED: 'false' },
      { PRODUCTION_SEED_LOGIN_UNTIL: '' },
      { PRODUCTION_SEED_LOGIN_UNTIL: '2000-01-01T00:00:00Z' },
    ]) {
      expect(
        (await redeemAcceptanceRequest(request(), allowed, { ...env, ...overrides }, { redeem }))
          .status,
      ).toBe(404)
    }
    expect(redeem).not.toHaveBeenCalled()
  })
  it('rejects bad origin, CSRF, content-type, malformed and oversized credentials before Phoenix', async () => {
    const redeem = vi.fn()
    for (const [req, status] of [
      [request({ origin: 'https://attacker.example' }), 403],
      [request({ 'X-Groupher-CSRF': '0' }), 403],
      [request({ 'content-type': 'text/plain' }), 415],
      [request({}, '{}'), 400],
      [request({}, 'x'.repeat(4096)), 400],
    ] as const) {
      expect((await redeemAcceptanceRequest(req, allowed, env, { redeem })).status).toBe(status)
    }
    expect(redeem).not.toHaveBeenCalled()
  })
  it('issues both official cookies and a decodable host-only Auth.js session', async () => {
    const response = await redeemAcceptanceRequest(request(), allowed, env, {
      redeem: vi.fn().mockResolvedValue(result),
    })
    expect(response.status).toBe(204)
    const name = getAuthSessionCookieName(useSecureCookies)
    const cookies = response.headers.getSetCookie()
    const authCookie = cookies.find((cookie) => cookie.startsWith(name + '='))!
    expect(authCookie).toContain('HttpOnly')
    expect(authCookie).not.toContain('Domain=')
    expect(cookies.some((cookie) => cookie.startsWith('groupher-auth.token='))).toBe(true)
    const token = authCookie.split(';')[0].slice(name.length + 1)
    const decoded = await decode({ token, secret: env.NEXTAUTH_SECRET, salt: name })
    expect(decoded?.browserSessionRef).toBe(result.browserSessionRef)
    expect(decoded?.sessionAbsoluteExpiresAt).toBe(result.sessionAbsoluteExpiresAt)
    vi.stubEnv('NEXTAUTH_SECRET', env.NEXTAUTH_SECRET)
    try {
      const probe = new Request('https://auth.groupher.com/api/auth/session', {
        headers: { cookie: `${name}=${token}` },
      })
      const session = await readBrowserSession(probe)
      expect(session?.browserSessionRef).toBe(result.browserSessionRef)
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('compensates Phoenix when Auth.js signing fails and emits no usable cookie', async () => {
    const revoke = vi.fn().mockResolvedValue(undefined)
    const response = await redeemAcceptanceRequest(request(), allowed, env, {
      redeem: vi.fn().mockResolvedValue(result),
      revoke,
      encodeSession: vi.fn().mockRejectedValue(new Error('sign failed')),
    })
    expect(response.status).toBe(401)
    expect(revoke).toHaveBeenCalledWith(result.browserSessionRef)
    expect(response.headers.has('set-cookie')).toBe(false)
  })
  it('never creates cookies on an upstream expired/used grant', async () => {
    const response = await redeemAcceptanceRequest(request(), allowed, env, {
      redeem: vi.fn().mockRejectedValue(new Error('used')),
    })
    expect(response.status).toBe(401)
    expect(response.headers.has('set-cookie')).toBe(false)
  })
})
