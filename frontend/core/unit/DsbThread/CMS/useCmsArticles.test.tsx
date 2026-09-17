import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  posts: {
    entries: [{ innerId: '20', title: 'A stale article', views: 158 }],
    pageNumber: 1,
    pageSize: 20,
    totalCount: 1,
    totalPages: 1,
  },
  summaries: [{ innerId: '20', revision: 7, views: 159 }],
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: unknown[] }) => {
    if (options.queryKey[1] === 'posts') {
      return { data: fixture.posts, isFetching: false }
    }

    if (options.queryKey[1] === 'view-summary') {
      return { data: fixture.summaries, isFetching: false }
    }

    return { data: undefined, isFetching: false }
  },
}))

vi.mock('~/query', () => ({
  Q: {
    article: {
      posts: (filter: unknown) => ({ queryKey: ['article', 'posts', filter] }),
      changelogs: (filter: unknown) => ({ queryKey: ['article', 'changelogs', filter] }),
      viewSummaries: (community: string, thread: string, ids: string[]) => ({
        queryKey: ['article', 'view-summary', community, thread, ids],
      }),
    },
  },
}))

vi.mock('~/stores/community/hooks', () => ({
  default: () => ({ slug: 'home' }),
}))

import useCmsArticles from './useCmsArticles'

describe('useCmsArticles', () => {
  it('merges the public Summary batch into the Dashboard article page', () => {
    const { result } = renderHook(() => useCmsArticles('post'))

    expect(result.current.pagedArticles.entries[0]).toMatchObject({
      innerId: '20',
      views: 159,
      viewsRevision: 7,
    })
  })
})
