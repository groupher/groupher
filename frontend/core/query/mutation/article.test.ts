import { QueryClient } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import type { TArticle, TPagedPosts } from '~/spec'

import { articleKeys, viewerKeys } from '../key'
import { mutateArticleUpvote, patchArticleEverywhere, toggleArticleUpvote } from './article'

const { browserQuery } = vi.hoisted(() => ({ browserQuery: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserQuery }))

const article = {
  id: 'db-1',
  innerId: '42',
  upvotesCount: 3,
  community: { slug: 'home' },
  meta: { thread: THREAD.POST },
} as TArticle

const path = { community: 'home', thread: THREAD.POST, innerId: '42' }
const postsKey = articleKeys.posts({ community: 'home' })
const detailKey = articleKeys.detail('home', THREAD.POST, '42')
const viewerKey = viewerKeys.articleStates('alice', ['home:POST:42'])

const setupClient = () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData<TPagedPosts>(postsKey, { entries: [article] } as TPagedPosts)
  queryClient.setQueryData(detailKey, article)
  queryClient.setQueryData(viewerKey, {
    'home:POST:42': { articleKey: 'home:POST:42', viewerHasUpvoted: false },
  })
  return queryClient
}

describe('article query mutation helpers', () => {
  beforeEach(() => browserQuery.mockReset())

  it('patches matching list and detail entries without touching other cache domains', () => {
    const queryClient = setupClient()
    queryClient.setQueryData(['community'], { title: 'Home' })
    const tagGroupsKey = articleKeys.tagGroups('home', THREAD.POST)
    queryClient.setQueryData(tagGroupsKey, article)

    patchArticleEverywhere(queryClient, path, (current) => ({ ...current, upvotesCount: 4 }))

    expect(queryClient.getQueryData<TPagedPosts>(postsKey)?.entries[0].upvotesCount).toBe(4)
    expect(queryClient.getQueryData<TArticle>(detailKey)?.upvotesCount).toBe(4)
    expect(queryClient.getQueryData(['community'])).toEqual({ title: 'Home' })
    expect(queryClient.getQueryData<TArticle>(tagGroupsKey)?.upvotesCount).toBe(3)
  })

  it('uses the server-confirmed count and viewer state', async () => {
    const queryClient = setupClient()
    browserQuery.mockResolvedValue({
      upvotePost: { innerId: '42', upvotesCount: 9, viewerHasUpvoted: true },
    })

    await toggleArticleUpvote(queryClient, article, true, 'alice')

    expect(queryClient.getQueryData<TArticle>(detailKey)?.upvotesCount).toBe(9)
    expect(
      queryClient.getQueryData<Record<string, { viewerHasUpvoted: boolean }>>(viewerKey)?.[
        'home:POST:42'
      ].viewerHasUpvoted,
    ).toBe(true)
  })

  it('rolls back list, detail and viewer cache when the mutation fails', async () => {
    const queryClient = setupClient()
    browserQuery.mockImplementationOnce(() => {
      throw new Error('network')
    })

    await expect(toggleArticleUpvote(queryClient, article, true, 'alice')).resolves.toBe(false)

    expect(queryClient.getQueryData<TPagedPosts>(postsKey)?.entries[0].upvotesCount).toBe(3)
    expect(queryClient.getQueryData<TArticle>(detailKey)?.upvotesCount).toBe(3)
    expect(
      queryClient.getQueryData<Record<string, { viewerHasUpvoted: boolean }>>(viewerKey)?.[
        'home:POST:42'
      ].viewerHasUpvoted,
    ).toBe(false)
  })

  it('uses the Doc mutation branch for Doc articles', async () => {
    const docArticle = {
      ...article,
      meta: { thread: THREAD.DOC },
    } as TArticle
    const queryClient = new QueryClient()
    const docKey = articleKeys.detail('home', THREAD.DOC, '42')
    queryClient.setQueryData(docKey, docArticle)
    browserQuery.mockResolvedValue({
      upvoteDoc: { innerId: '42', upvotesCount: 5, viewerHasUpvoted: true },
    })

    await expect(toggleArticleUpvote(queryClient, docArticle, true, 'alice')).resolves.toBe(true)

    expect(browserQuery).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData<TArticle>(docKey)?.upvotesCount).toBe(5)
  })

  it('coalesces rapid toggles to the last intent and removes command mutations', async () => {
    const queryClient = setupClient()
    browserQuery
      .mockResolvedValueOnce({
        upvotePost: { innerId: '42', upvotesCount: 4, viewerHasUpvoted: true },
      })
      .mockResolvedValueOnce({
        undoUpvotePost: { innerId: '42', upvotesCount: 3, viewerHasUpvoted: false },
      })

    const first = mutateArticleUpvote(queryClient, article, true, 'alice')
    const second = mutateArticleUpvote(queryClient, article, true, 'alice')
    await Promise.all([first, second])

    expect(browserQuery).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData<TArticle>(detailKey)?.upvotesCount).toBe(3)
    expect(
      queryClient.getQueryData<Record<string, { viewerHasUpvoted: boolean }>>(viewerKey)?.[
        'home:POST:42'
      ].viewerHasUpvoted,
    ).toBe(false)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it('collapses three rapid toggles into the first in-flight target', async () => {
    const queryClient = setupClient()
    browserQuery.mockResolvedValue({
      upvotePost: { innerId: '42', upvotesCount: 4, viewerHasUpvoted: true },
    })

    const first = mutateArticleUpvote(queryClient, article, true, 'alice')
    const second = mutateArticleUpvote(queryClient, article, true, 'alice')
    const third = mutateArticleUpvote(queryClient, article, true, 'alice')
    await Promise.all([first, second, third])

    expect(browserQuery).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData<TArticle>(detailKey)?.upvotesCount).toBe(4)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })
})
