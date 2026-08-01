import { createHmac } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPhoenixToken } from './phoenix-token'

const base64UrlEncode = (value: unknown): string =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')

const signedToken = (payload: Record<string, unknown> = {}, secret = 'phoenix-jwt-secret'): string => {
  const header = base64UrlEncode({ alg: 'HS512', typ: 'JWT' })
  const body = base64UrlEncode({
    exp: Math.floor(Date.now() / 1000) + 60,
    iss: 'groupher_server',
    sub: '42',
    ...payload,
  })
  const signature = createHmac('sha512', secret).update(`${header}.${body}`).digest('base64url')

  return `${header}.${body}.${signature}`
}

describe('getPhoenixToken', () => {
  beforeEach(() => {
    vi.stubEnv('PHX_JWT_SECRET', 'phoenix-jwt-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reads the canonical Phoenix token cookie after verifying the JWT signature', () => {
    const token = signedToken()
    const request = new Request('https://dashboard.groupher.localhost', {
      headers: {
        cookie: `theme=dark; groupher-auth.token=${encodeURIComponent(token)}`,
      },
    })

    expect(getPhoenixToken(request)).toBe(token)
  })

  it('rejects unsigned or forged Phoenix token cookies', () => {
    const request = new Request('https://dashboard.groupher.localhost', {
      headers: {
        cookie: 'theme=dark; groupher-auth.token=phoenix-token',
      },
    })

    expect(getPhoenixToken(request)).toBeNull()
  })

  it('rejects expired Phoenix token cookies', () => {
    const request = new Request('https://dashboard.groupher.localhost', {
      headers: {
        cookie: `groupher-auth.token=${signedToken({ exp: Math.floor(Date.now() / 1000) - 1 })}`,
      },
    })

    expect(getPhoenixToken(request)).toBeNull()
  })

  it('rejects validly signed tokens from another issuer', () => {
    const request = new Request('https://dashboard.groupher.localhost', {
      headers: {
        cookie: `groupher-auth.token=${signedToken({ iss: 'other' })}`,
      },
    })

    expect(getPhoenixToken(request)).toBeNull()
  })

  it('rejects Phoenix token cookies when the Phoenix JWT secret is not configured', () => {
    vi.unstubAllEnvs()
    const request = new Request('https://dashboard.groupher.localhost', {
      headers: {
        cookie: `groupher-auth.token=${signedToken()}`,
      },
    })

    expect(getPhoenixToken(request)).toBeNull()
  })

  it('does not read the Auth.js Session cookie', () => {
    const request = new Request('https://dashboard.groupher.localhost', {
      headers: {
        cookie: '__Secure-groupher-auth.session-token=auth-session',
      },
    })

    expect(getPhoenixToken(request)).toBeNull()
  })
})
