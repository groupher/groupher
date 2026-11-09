import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

import type { TTicket } from '~/spec'

import useKanbanTickets from './index'

const mocks = vi.hoisted(() => ({
  kanban: vi.fn(),
  statsBatch: vi.fn(),
  statsBatches: new Map<string, number[]>(),
}))

vi.mock('~/hooks/usePagiConfig', () => ({
  default: () => ({
    config: { defaultSize: 20, mode: 'page', revision: 1 },
    ready: true,
  }),
}))
vi.mock('~/query', () => ({
  Q: {
    article: { statsBatch: mocks.statsBatch },
    ticket: { kanban: mocks.kanban, page: vi.fn() },
  },
}))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/stores/dsbConfig/hooks', () => ({ default: () => ({}) }))

const createTicket = (postInnerId: number): TTicket =>
  ({
    id: `ticket-${postInnerId}`,
    sources: [
      {
        id: `source-${postInnerId}`,
        type: 'POST',
        innerId: postInnerId,
        title: `Post ${postInnerId}`,
      },
    ],
  }) as unknown as TTicket

describe('useKanbanTickets', () => {
  beforeEach(() => {
    mocks.statsBatches.clear()
    const entries = Array.from({ length: 205 }, (_, index) => createTicket(index + 1))
    mocks.kanban.mockImplementation((community: string) => ({
      queryKey: ['ticket', 'kanban', community],
      queryFn: async () => ({
        todo: {
          entries,
          pageInfo: {
            __typename: 'OffsetPageInfo',
            hasNextPage: false,
            hasPreviousPage: false,
            page: 1,
            size: 20,
            totalCount: entries.length,
            totalPages: 11,
          },
        },
        wip: { entries: [], pageInfo: { __typename: 'OffsetPageInfo' } },
        done: { entries: [], pageInfo: { __typename: 'OffsetPageInfo' } },
      }),
    }))
    mocks.statsBatch.mockImplementation((_client, _community, _thread, innerIds: number[]) => {
      mocks.statsBatches.set(innerIds.join(','), [...innerIds])
      return {
        queryKey: ['article', 'ticket-stats', ...innerIds],
        queryFn: async () =>
          innerIds.map((innerId) => ({
            innerId,
            upvotesCount: 1,
            commentsCount: 2,
            views: 3,
          })),
      }
    })
  })

  it('batches stats for all linked Posts by the ArticleStats limit', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children)
    const { result } = renderHook(() => useKanbanTickets(), { wrapper })

    await waitFor(() => expect(result.current.todo.entries).toHaveLength(205))
    await waitFor(() => expect(mocks.statsBatches.size).toBe(3))

    const batches = [...mocks.statsBatches.values()]
    const batchSizes = batches.map((batch) => batch.length)
    expect(batchSizes).toEqual([100, 100, 5])
    expect(batches.flat()).toEqual(
      Array.from({ length: 205 }, (_, index) => String(index + 1))
        .sort()
        .map(Number),
    )
    expect(result.current.todo.entries[0].stats).toEqual({
      upvotesCount: 1,
      commentsCount: 2,
      views: 3,
    })
    expect(result.current.todo.entries[204].stats.views).toBe(3)
  })
})
