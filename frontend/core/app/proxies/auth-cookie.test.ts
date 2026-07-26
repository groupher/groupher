import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAuthTokenMock } = vi.hoisted(() => ({
  getAuthTokenMock: vi.fn(),
}))

vi.mock('~/app/auth-token', () => ({
  getAuthToken: getAuthTokenMock,
}))

import { authCookieProxy, shouldSyncAuthTokenCookie } from './auth-cookie'

describe('shouldSyncAuthTokenCookie', () => {
  beforeEach(() => {
    getAuthTokenMock.mockReset()
  })

  it('writes the canonical token when it is missing', () => {
    expect(
      shouldSyncAuthTokenCookie({
        currentToken: null,
        nextToken: 'phoenix-token',
      }),
    ).toBe(true)
  })

  it('skips a token already synchronized to the canonical cookie', () => {
    expect(
      shouldSyncAuthTokenCookie({
        currentToken: 'phoenix-token',
        nextToken: 'phoenix-token',
      }),
    ).toBe(false)
  })

  it('refreshes the shared cookie when the Phoenix token changes', () => {
    expect(
      shouldSyncAuthTokenCookie({
        currentToken: 'old-token',
        nextToken: 'new-token',
      }),
    ).toBe(true)
  })

  it('writes the Phoenix token under the canonical Groupher cookie name', async () => {
    getAuthTokenMock.mockResolvedValue({ 'auth.token': 'phoenix-token' })

    const response = await authCookieProxy(
      new Request('https://dashboard.groupher.localhost/home/dashboard'),
    )
    const setCookie = response.headers.get('set-cookie') || ''

    expect(setCookie).toContain('groupher-auth.token=phoenix-token')
    expect(setCookie).not.toMatch(/(?:^|;|,) auth\.token=/)
  })
})
