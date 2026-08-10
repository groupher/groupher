import { afterEach, describe, expect, it, vi } from 'vitest'

const { refreshSession } = vi.hoisted(() => ({
  refreshSession: vi.fn(async () => undefined),
}))

vi.mock('~/auth', () => ({
  AuthRequestError: class extends Error {},
  authFailureFromError: () => ({}),
  invalidateAuthState: vi.fn(),
  refreshSession,
  requestLogin: vi.fn(),
  resolveAuthFailure: ({ code }: { code?: string }) =>
    code === 'TOKEN_EXPIRED' || code === 'TOKEN_MISSING' ? 'refresh' : 'none',
  withAuthRetry: async <T>(
    operation: () => Promise<T>,
    resolveFailure: (error: unknown) => { code?: string },
  ) => {
    try {
      return await operation()
    } catch (error) {
      const failure = resolveFailure(error)
      if (failure.code !== 'TOKEN_EXPIRED' && failure.code !== 'TOKEN_MISSING') throw error
      await refreshSession()
      return operation()
    }
  },
}))

import { createAuthFetch } from './client'

describe('createAuthFetch', () => {
  afterEach(() => {
    vi.clearAllMocks()
    document.cookie = 'groupher-auth.signed-in=; Max-Age=0; Path=/'
  })

  it('refreshes once and replays an expired authenticated GraphQL operation once', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          errors: [{ extensions: { code: 'TOKEN_EXPIRED' }, message: 'expired' }],
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: { me: { id: '42' } } }))

    const response = await createAuthFetch(fetcher)('/api/graphql', {
      body: JSON.stringify({ query: 'query Viewer { me { id } }' }),
      method: 'POST',
    })

    await expect(response.json()).resolves.toEqual({ data: { me: { id: '42' } } })
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not refresh permission failures', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        errors: [{ extensions: { code: 'PERMISSION_DENIED' }, message: 'forbidden' }],
      }),
    )

    await createAuthFetch(fetcher)('/api/graphql', { method: 'POST' })

    expect(refreshSession).not.toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refreshes a missing HttpOnly token when the readable signed-in hint remains', async () => {
    document.cookie = 'groupher-auth.signed-in=1; Path=/'
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          errors: [{ extensions: { code: 4301 }, message: 'Authorize: need login' }],
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: { me: { id: '42' } } }))

    await createAuthFetch(fetcher)('/api/graphql', { method: 'POST' })

    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
