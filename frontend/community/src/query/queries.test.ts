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
    expect(communityQueries.articleStats('home', THREAD.POST, ['1']).staleTime).toBe(600_000)
  })
})
