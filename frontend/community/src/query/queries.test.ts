import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { THREAD } from '~/const/thread'

import { communityQueries } from './queries'

describe('Community query freshness', () => {
  it('inherits shared QueryClient freshness for public content queries', () => {
    const queries = [
      communityQueries.posts('home'),
      communityQueries.post('home', '1'),
      communityQueries.changelogs('home'),
      communityQueries.changelog('home', '1'),
      communityQueries.comments('home', THREAD.POST, '1'),
      communityQueries.kanban('home'),
      communityQueries.doc('home', '1'),
    ]

    expect(queries.every((query) => query.staleTime === undefined)).toBe(true)
  })

  it('keeps the ArticleStats cache policy override', () => {
    const queryClient = new QueryClient()
    const query = communityQueries.stats(queryClient, 'home', THREAD.POST, ['1'])

    expect(query.staleTime).toBe(600_000)
    expect(query.structuralSharing).toBeTypeOf('function')
  })
})
