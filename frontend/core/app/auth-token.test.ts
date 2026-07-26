import { getToken } from 'next-auth/jwt'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }))

describe('getAuthToken', () => {
  const originalAuthUrl = process.env.AUTH_URL

  afterEach(() => {
    vi.resetModules()
    vi.mocked(getToken).mockReset()
    if (originalAuthUrl === undefined) delete process.env.AUTH_URL
    else process.env.AUTH_URL = originalAuthUrl
  })

  it('reads the secure Auth.js cookie used by the canonical HTTPS gateway', async () => {
    process.env.AUTH_URL = 'https://groupher.localhost'
    const { getAuthToken } = await import('./auth-token')
    const request = new Request('https://groupher.localhost/home')

    await getAuthToken(request)

    expect(getToken).toHaveBeenCalledWith({
      req: request,
      cookieName: '__Secure-groupher-auth.session-token',
      raw: false,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: true,
    })
  })
})
