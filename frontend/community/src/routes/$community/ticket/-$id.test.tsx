import { communityQueries } from '@community/query/queries'
import { describe, expect, it, vi } from 'vitest'

import { THREAD } from '~/const/thread'

import { Route } from './$id'

vi.mock('@community/query/queries', () => ({
  communityQueries: {
    ticket: vi.fn(() => ({ queryKey: ['ticket'] })),
    stats: vi.fn((_queryClient, community, thread, innerIds) => ({
      queryKey: ['ticket-source-stats', community, thread, innerIds],
    })),
  },
}))

describe('Ticket detail loader', () => {
  it('hydrates source Post stats in batches no larger than the ArticleStats limit', async () => {
    const sources = Array.from({ length: 205 }, (_, index) => ({ innerId: index + 1 }))
    const queryClient = {
      fetchQuery: vi.fn(async () => ({ sources, title: 'Ticket detail' })),
      ensureQueryData: vi.fn(async ({ queryKey }: { queryKey: readonly unknown[] }) => {
        const ids = queryKey[3] as number[]
        return ids.map((innerId) => ({
          innerId,
          upvotesCount: 1,
          commentsCount: 2,
          views: 3,
        }))
      }),
    }
    const load = Route.options.loader as unknown as (input: {
      context: { queryClient: typeof queryClient }
      params: { community: string; id: string }
    }) => Promise<{ ticket: { sources: typeof sources }; stats: Record<string, number> }>

    const result = await load({
      context: { queryClient },
      params: { community: 'community', id: '7' },
    })

    expect(communityQueries.stats).toHaveBeenCalledTimes(3)
    expect(
      vi
        .mocked(communityQueries.stats)
        .mock.calls.map(([, community, thread, ids]) => [community, thread, ids.length]),
    ).toEqual([
      ['community', THREAD.POST, 100],
      ['community', THREAD.POST, 100],
      ['community', THREAD.POST, 5],
    ])
    expect(result.ticket.sources).toHaveLength(205)
    expect(result.stats).toEqual({ upvotesCount: 205, commentsCount: 410, views: 615 })
  })
})
