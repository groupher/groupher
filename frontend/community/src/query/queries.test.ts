import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { THREAD } from '~/const/thread'
import { articleQueries } from '~/query/article'
import type { TEffectivePagiConfig } from '~/spec'

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

  it('uses an infinite hydration contract for cursor article surfaces', () => {
    const config: TEffectivePagiConfig = {
      api: 'cursor',
      mode: 'LOAD_MORE',
      schemaVersion: 1,
      revision: 3,
      defaultSize: 10,
      maxSize: 100,
    }
    const filter = { community: 'home', order: 'UPVOTES' }
    const posts = communityQueries.postsInfinite('home', config, filter)
    const changelogs = communityQueries.changelogsInfinite('home', config, filter)

    expect(posts.initialPageParam).toBeNull()
    expect(changelogs.initialPageParam).toBeNull()
    expect(posts.getNextPageParam).toBeTypeOf('function')
    expect(changelogs.getNextPageParam).toBeTypeOf('function')
    expect(posts.queryKey).not.toEqual(
      communityQueries.postsInfinite('home', config, { community: 'home' }).queryKey,
    )
  })

  it('uses the same offset request and cache key as the browser on page two', () => {
    const config: TEffectivePagiConfig = {
      api: 'offset',
      mode: 'PAGE',
      schemaVersion: 1,
      revision: 4,
      defaultSize: 20,
      maxSize: 100,
    }
    const filter = { community: 'home', page: 2, size: 40, order: 'PUBLISH' }

    expect(communityQueries.posts('home', config, filter).queryKey).toEqual(
      articleQueries.posts(filter, config).queryKey,
    )
    expect(communityQueries.changelogs('home', config, filter).queryKey).toEqual(
      articleQueries.changelogs(filter, config).queryKey,
    )
  })
})
