import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { THREAD } from '~/const/thread'

import { invalidate, markStale, QueryInvalidation } from './invalidation'
import { articleKeys, commentKeys, viewerKeys } from './key'

const createClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('typed query invalidation', () => {
  it('marks an exact owner-provided query stale without invalidating related keys', async () => {
    const queryClient = createClient()
    const exact = articleKeys.stats('home', THREAD.POST, '42')
    const batch = articleKeys.statsBatch('home', THREAD.POST, ['42'])
    queryClient.setQueryData(exact, { innerId: '42' })
    queryClient.setQueryData(batch, [{ innerId: '42' }])

    await markStale(queryClient, exact)

    expect(queryClient.getQueryState(exact)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(batch)?.isInvalidated).toBe(false)
  })

  it('invalidates one ArticleStats entity and the batch containing it only', async () => {
    const queryClient = createClient()
    const exact = articleKeys.stats('home', THREAD.POST, '42')
    const batch = articleKeys.statsBatch('home', THREAD.POST, ['41', '42'])
    const other = articleKeys.stats('home', THREAD.POST, '43')
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
    const stats = articleKeys.stats('home', THREAD.POST, '42')
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
    const current = viewerKeys.articleStates('account-a', ['home:POST:42'])
    const other = viewerKeys.articleStates('account-b', ['home:POST:42'])
    queryClient.setQueryData(current, {})
    queryClient.setQueryData(other, {})

    await invalidate(queryClient, QueryInvalidation.viewer.articleState('account-a'))

    expect(queryClient.getQueryState(current)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(false)
  })
})
