import {
  AUTH_ERROR,
  GROUPHER_AUTH_CSRF_HEADER,
  GROUPHER_AUTH_CSRF_VALUE,
} from '@groupher/contracts/auth'
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
    code === AUTH_ERROR.TOKEN_EXPIRED || code === AUTH_ERROR.TOKEN_MISSING ? 'refresh' : 'none',
  withAuthRetry: async <T>(
    operation: () => Promise<T>,
    resolveFailure: (error: unknown) => { code?: string },
  ) => {
    try {
      return await operation()
    } catch (error) {
      const failure = resolveFailure(error)
      if (failure.code !== AUTH_ERROR.TOKEN_EXPIRED && failure.code !== AUTH_ERROR.TOKEN_MISSING)
        throw error
      await refreshSession()
      return operation()
    }
  },
}))

import { parse } from 'graphql'

import {
  browserGraphQLRequest,
  createAuthFetch,
  GraphQLRequestError,
  GraphQLResponseError,
} from './client'

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
          errors: [{ extensions: { code: AUTH_ERROR.TOKEN_EXPIRED }, message: 'expired' }],
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

  it('refreshes when the explicit session probe reports an invalid session', async () => {
    document.cookie = 'groupher-auth.signed-in=1; Path=/'
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: { sessionState: { isValid: false } } }))
      .mockResolvedValueOnce(
        Response.json({ data: { sessionState: { isValid: true, user: { id: '42' } } } }),
      )

    const response = await createAuthFetch(fetcher)('/api/graphql', { method: 'POST' })

    await expect(response.json()).resolves.toEqual({
      data: { sessionState: { isValid: true, user: { id: '42' } } },
    })
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not refresh a nullable public me result', async () => {
    document.cookie = 'groupher-auth.signed-in=1; Path=/'
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: { me: null } }))

    const response = await createAuthFetch(fetcher)('/api/graphql', { method: 'POST' })

    await expect(response.json()).resolves.toEqual({ data: { me: null } })
    expect(refreshSession).not.toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('returns typed data through the same-origin browser transport', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: { value: 42 } }))
    const data = await browserGraphQLRequest<{ value: number }, Record<string, never>>(
      parse('query Value { value }'),
      {},
      { fetcher },
    )

    expect(data).toEqual({ value: 42 })
    const [requestUrl, requestInit] = fetcher.mock.calls[0] || []
    expect(String(requestUrl)).toContain('/api/graphql')
    expect(requestInit).toEqual(
      expect.objectContaining({ cache: 'no-store', credentials: 'include', method: 'POST' }),
    )
    expect(requestInit?.headers).toEqual({
      'Content-Type': 'application/json',
      [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
    })
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      query: 'query Value {\n  value\n}',
      variables: {},
    })
  })

  it('forwards AbortSignal through the GraphQL transport', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: { value: 42 } }))
    const signal = new AbortController().signal

    await browserGraphQLRequest(parse('query Value { value }'), {}, { fetcher, signal })

    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(signal)
  })

  it('preserves a fetch TypeError for QueryClient retry classification', async () => {
    const error = new TypeError('network unavailable')
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(error)

    await expect(
      browserGraphQLRequest(parse('query Value { value }'), {}, { fetcher }),
    ).rejects.toBe(error)
  })

  it('throws GraphQL business errors so Query does not treat them as data', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ errors: [{ extensions: { code: 'INVALID_INPUT' }, message: 'invalid' }] }),
      )

    await expect(
      browserGraphQLRequest(parse('mutation Save { save }'), {}, { fetcher }),
    ).rejects.toBeInstanceOf(GraphQLRequestError)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('formats structured changeset errors instead of collapsing them to object text', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        errors: [
          {
            extensions: { code: 4102 },
            message: [{ key: 'gradient', message: 'has unsupported config' }],
          },
        ],
      }),
    )

    await expect(
      browserGraphQLRequest(parse('mutation Save { save }'), {}, { fetcher }),
    ).rejects.toMatchObject({ message: 'gradient: has unsupported config' })
  })

  it.each([
    [4530, 'This operation changed elsewhere. Refresh and try again.'],
    [4531, 'This operation is still being processed. Please try again shortly.'],
    [4532, 'This operation is missing its command key. Please submit it again.'],
  ])('maps command error code %s to an actionable message', async (code, message) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ errors: [{ extensions: { code }, message: 'internal command error' }] }),
      )

    await expect(
      browserGraphQLRequest(parse('mutation Save { save }'), {}, { fetcher }),
    ).rejects.toMatchObject({ message })
  })

  it('preserves the final response and errors when an auth replay still fails', async () => {
    const finalResponse = Response.json({
      errors: [{ extensions: { code: 'INVALID_INPUT' }, message: 'still invalid' }],
    })
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          errors: [{ extensions: { code: AUTH_ERROR.TOKEN_EXPIRED }, message: 'expired' }],
        }),
      )
      .mockResolvedValueOnce(finalResponse)

    await expect(
      browserGraphQLRequest(parse('mutation Save { save }'), {}, { fetcher }),
    ).rejects.toMatchObject({
      errors: [{ extensions: { code: 'INVALID_INPUT' }, message: 'still invalid' }],
      response: finalResponse,
    })
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('throws GraphQLRequestError for non-2xx GraphQL errors', async () => {
    const response = Response.json(
      { errors: [{ extensions: { code: 'UPSTREAM_FAILURE' }, message: 'unavailable' }] },
      { status: 503 },
    )
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)

    const request = browserGraphQLRequest(parse('query Value { value }'), {}, { fetcher })

    await expect(request).rejects.toBeInstanceOf(GraphQLRequestError)
    await expect(request).rejects.toMatchObject({ errors: [{ message: 'unavailable' }], response })
  })

  it('throws GraphQLRequestError for a non-2xx invalid JSON response', async () => {
    const response = new Response('not json', { status: 502 })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)

    const request = browserGraphQLRequest(parse('query Value { value }'), {}, { fetcher })

    await expect(request).rejects.toBeInstanceOf(GraphQLRequestError)
    await expect(request).rejects.toMatchObject({ response })
  })

  it('throws GraphQLResponseError with the parse cause for a 2xx invalid JSON response', async () => {
    const response = new Response('not json', { status: 200 })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)

    const request = browserGraphQLRequest(parse('query Value { value }'), {}, { fetcher })

    await expect(request).rejects.toBeInstanceOf(GraphQLResponseError)
    await expect(request).rejects.toMatchObject({ cause: expect.any(SyntaxError), response })
  })

  it('throws GraphQLResponseError when a 2xx response omits data', async () => {
    const response = Response.json({})
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)

    const request = browserGraphQLRequest(parse('query Value { value }'), {}, { fetcher })

    await expect(request).rejects.toBeInstanceOf(GraphQLResponseError)
    await expect(request).rejects.not.toBeInstanceOf(GraphQLRequestError)
    await expect(request).rejects.toMatchObject({ payload: {}, response })
  })

  it('accepts a nullable top-level data result', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: null }))

    await expect(
      browserGraphQLRequest<null>(parse('query Nullable { nullable }'), {}, { fetcher }),
    ).resolves.toBeNull()
  })

  it('classifies a non-object JSON envelope as a response error', async () => {
    const response = Response.json(null)
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)

    await expect(
      browserGraphQLRequest(parse('query Value { value }'), {}, { fetcher }),
    ).rejects.toMatchObject({ name: 'GraphQLResponseError', payload: null, response })
  })
})
