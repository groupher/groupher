import { dehydrate, hydrate } from '@tanstack/react-query'

import { GraphQLRequestError, GraphQLResponseError } from '~/graphql/client'

import { createQueryClient } from './queryClient'

describe('QueryClient lifecycle', () => {
  it('creates isolated request clients and dehydrates successful public queries', async () => {
    const requestA = createQueryClient()
    const requestB = createQueryClient()
    const fetcher = vi.fn(async () => ({ entries: [{ innerId: '1' }] }))

    await requestA.prefetchQuery({
      queryKey: ['article', 'posts'],
      queryFn: fetcher,
      meta: { hydration: 'public' },
    })

    expect(requestA).not.toBe(requestB)
    expect(requestB.getQueryData(['article', 'posts'])).toBeUndefined()
    expect(dehydrate(requestA).queries).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not dehydrate failed queries', async () => {
    const queryClient = createQueryClient()
    await queryClient.prefetchQuery({
      queryKey: ['failed'],
      queryFn: async () => {
        throw new Error('failed')
      },
      retry: false,
    })

    expect(dehydrate(queryClient).queries).toHaveLength(0)
  })

  it('reuses a fresh dehydrated query without a duplicate browser fetch', async () => {
    const server = createQueryClient()
    const browser = createQueryClient()
    const queryKey = ['article', 'posts', { community: 'home', page: 1 }] as const
    const serverFetcher = vi.fn(async () => ({ entries: [{ innerId: '1' }] }))
    const browserFetcher = vi.fn(async () => ({ entries: [{ innerId: '2' }] }))

    await server.prefetchQuery({ queryKey, queryFn: serverFetcher, meta: { hydration: 'public' } })
    hydrate(browser, dehydrate(server))

    const data = await browser.fetchQuery({ queryKey, queryFn: browserFetcher })

    expect(data).toEqual({ entries: [{ innerId: '1' }] })
    expect(serverFetcher).toHaveBeenCalledTimes(1)
    expect(browserFetcher).not.toHaveBeenCalled()
  })

  it('retries only fetch TypeErrors under the shared policy', async () => {
    const networkClient = createQueryClient()
    const networkError = new TypeError('network unavailable')
    const networkQuery = vi.fn(async () => {
      throw networkError
    })

    await expect(
      networkClient.fetchQuery({
        queryFn: networkQuery,
        queryKey: ['retry', 'network'],
        retryDelay: 0,
      }),
    ).rejects.toBe(networkError)
    expect(networkQuery).toHaveBeenCalledTimes(3)

    const response = Response.json({}, { status: 500 })
    const nonRetryableErrors = [
      new GraphQLRequestError(response, []),
      new GraphQLResponseError('invalid response', response),
    ]

    for (const [index, error] of nonRetryableErrors.entries()) {
      const queryClient = createQueryClient()
      const queryFn = vi.fn(async () => {
        throw error
      })

      await expect(
        queryClient.fetchQuery({
          queryFn,
          queryKey: ['retry', 'graphql', index],
          retryDelay: 0,
        }),
      ).rejects.toBe(error)
      expect(queryFn).toHaveBeenCalledTimes(1)
    }
  })
})
