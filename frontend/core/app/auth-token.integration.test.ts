// @vitest-environment node

import { encode } from 'next-auth/jwt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAuthSessionCookieName } from '~/constant/auth-contract'

describe('getAuthToken cookie migration', () => {
  const originalAuthUrl = process.env.AUTH_URL
  const originalSecret = process.env.NEXTAUTH_SECRET

  afterEach(() => {
    vi.resetModules()
    if (originalAuthUrl === undefined) delete process.env.AUTH_URL
    else process.env.AUTH_URL = originalAuthUrl
    if (originalSecret === undefined) delete process.env.NEXTAUTH_SECRET
    else process.env.NEXTAUTH_SECRET = originalSecret
  })

  it('ignores a legacy Auth.js cookie when both cookie names are present', async () => {
    const secret = 'auth-cookie-contract-test-secret'
    const currentCookieName = getAuthSessionCookieName(true)
    const legacyCookieName = '__Secure-authjs.session-token'
    process.env.AUTH_URL = 'https://groupher.localhost'
    process.env.NEXTAUTH_SECRET = secret

    const [currentToken, legacyToken] = await Promise.all([
      encode({
        token: { 'auth.token': 'current-backend-token' },
        secret,
        salt: currentCookieName,
      }),
      encode({
        token: { 'auth.token': 'legacy-backend-token' },
        secret,
        salt: legacyCookieName,
      }),
    ])
    const request = new Request('https://dashboard.groupher.localhost/home/dashboard', {
      headers: {
        cookie: `${legacyCookieName}=${legacyToken}; ${currentCookieName}=${currentToken}`,
      },
    })

    const { getAuthToken } = await import('./auth-token')

    await expect(getAuthToken(request)).resolves.toMatchObject({
      'auth.token': 'current-backend-token',
    })
  })
})
