import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { THREAD } from '~/const/thread'

import { invalidate, markStale, QueryInvalidation } from './invalidation'
import { articleQueryKeys, commentKeys, viewerQueryKeys } from './key'

const createClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('typed query invalidation', () => {
  it('marks an exact owner-provided query stale without invalidating related keys', async () => {
    const queryClient = createClient()
    const exact = articleQueryKeys.stats('home', THREAD.POST, '42')
    const batch = articleQueryKeys.statsBatch('home', THREAD.POST, ['42'])
    queryClient.setQueryData(exact, { innerId: '42' })
    queryClient.setQueryData(batch, [{ innerId: '42' }])

    await markStale(queryClient, exact)

    expect(queryClient.getQueryState(exact)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(batch)?.isInvalidated).toBe(false)
  })

  it('invalidates one ArticleStats entity and the batch containing it only', async () => {
    const queryClient = createClient()
    const exact = articleQueryKeys.stats('home', THREAD.POST, '42')
    const batch = articleQueryKeys.statsBatch('home', THREAD.POST, ['41', '42'])
    const other = articleQueryKeys.stats('home', THREAD.POST, '43')
    queryClient.setQueryData(exact, { innerId: '42' })
    queryClient.setQueryData(batch, [{ innerId: '42' }])
    queryClient.setQueryData(other, { innerId: '43' })

    const result = await invalidate(
      queryClient,
      QueryInvalidation.article.stats({ community: 'home', thread: THREAD.POST, innerId: '42' }),
    )

    expect(result.matched).toBe(2)
    expect(queryClient.getQueryState(exact)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(batch)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(false)
  })

  it('deduplicates overlapping article and comment targets', async () => {
    const queryClient = createClient()
    const comments = commentKeys.list('home', THREAD.POST, '42')
    const stats = articleQueryKeys.stats('home', THREAD.POST, '42')
    queryClient.setQueryData(comments, [])
    queryClient.setQueryData(stats, {})

    const result = await invalidate(queryClient, [
      QueryInvalidation.comment.list({ community: 'home', thread: THREAD.POST, innerId: '42' }),
      QueryInvalidation.article.stats({ community: 'home', thread: THREAD.POST, innerId: '42' }),
    ])

    expect(result.matched).toBe(2)
    expect(result.deduped).toBe(0)
    expect(queryClient.getQueryState(comments)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(stats)?.isInvalidated).toBe(true)
  })

  it('does not cross the account boundary for viewer state', async () => {
    const queryClient = createClient()
    const current = viewerQueryKeys.articleStates('account-a', ['home:POST:42'])
    const other = viewerQueryKeys.articleStates('account-b', ['home:POST:42'])
    queryClient.setQueryData(current, {})
    queryClient.setQueryData(other, {})

    await invalidate(queryClient, QueryInvalidation.viewer.articleState('account-a'))

    expect(queryClient.getQueryState(current)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(false)
  })

  it('invalidates only the selected stats batch scope', async () => {
    const queryClient = createClient()
    const posts = articleQueryKeys.statsBatch('home', THREAD.POST, ['42'])
    const changelogs = articleQueryKeys.statsBatch('home', THREAD.CHANGELOG, ['42'])
    queryClient.setQueryData(posts, [])
    queryClient.setQueryData(changelogs, [])

    await invalidate(queryClient, QueryInvalidation.article.statsBatch('home', THREAD.POST))

    expect(queryClient.getQueryState(posts)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(changelogs)?.isInvalidated).toBe(false)
  })

  it('invalidates only lists in the selected community and thread family', async () => {
    const queryClient = createClient()
    const posts = articleQueryKeys.posts({ community: 'home' })
    const changelogs = articleQueryKeys.changelogs({ community: 'home' })
    const other = articleQueryKeys.posts({ community: 'other' })
    queryClient.setQueryData(posts, {})
    queryClient.setQueryData(changelogs, {})
    queryClient.setQueryData(other, {})

    await invalidate(
      queryClient,
      QueryInvalidation.article.lists({ community: 'home', thread: THREAD.POST }),
    )

    expect(queryClient.getQueryState(posts)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(changelogs)?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(false)
  })
})
