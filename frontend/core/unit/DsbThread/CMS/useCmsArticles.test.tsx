import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  queryClient: {},
  posts: {
    entries: [{ innerId: '20', title: 'A stale article' }],
    pageNumber: 1,
    pageSize: 20,
    totalCount: 1,
    totalPages: 1,
  },
  stats: [{ innerId: '20', viewsRevision: 7, views: 159 }],
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => fixture.queryClient,
  useQuery: (options: { queryKey: unknown[] }) => {
    if (options.queryKey[1] === 'posts') {
      return { data: fixture.posts, isFetching: false }
    }

    if (options.queryKey[1] === 'article-stats') {
      return { data: fixture.stats, isFetching: false }
    }

    return { data: undefined, isFetching: false }
  },
}))

vi.mock('~/query', () => ({
  Q: {
    article: {
      posts: (filter: unknown) => ({ queryKey: ['article', 'posts', filter] }),
      changelogs: (filter: unknown) => ({ queryKey: ['article', 'changelogs', filter] }),
      statsBatch: (_queryClient: unknown, community: string, thread: string, ids: string[]) => ({
        queryKey: ['article', 'article-stats', community, thread, ids],
      }),
    },
  },
}))

vi.mock('~/stores/community/hooks', () => ({
  default: () => ({ slug: 'home' }),
}))

import useCmsArticles from './useCmsArticles'

describe('useCmsArticles', () => {
  it('keeps public ArticleStats separate from the Dashboard article content', () => {
    const { result } = renderHook(() => useCmsArticles('post'))

    expect(result.current.pagedArticles.entries[0]).toMatchObject({
      content: { innerId: '20' },
      stats: { views: 159, viewsRevision: 7 },
    })
  })
})
