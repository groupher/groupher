import { dehydrate, hydrate } from '@tanstack/react-query'

import { createQueryClient } from './queryClient'

describe('QueryClient lifecycle', () => {
  it('creates isolated request clients and dehydrates successful public queries', async () => {
    const requestA = createQueryClient()
    const requestB = createQueryClient()
    const fetcher = vi.fn(async () => ({ entries: [{ innerId: '1' }] }))

    await requestA.prefetchQuery({ queryKey: ['article', 'posts'], queryFn: fetcher })

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

    await server.prefetchQuery({ queryKey, queryFn: serverFetcher })
    hydrate(browser, dehydrate(server))

    const data = await browser.fetchQuery({ queryKey, queryFn: browserFetcher })

    expect(data).toEqual({ entries: [{ innerId: '1' }] })
    expect(serverFetcher).toHaveBeenCalledTimes(1)
    expect(browserFetcher).not.toHaveBeenCalled()
  })
})
