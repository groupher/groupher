import { QueryClient } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import type { TArticle, TPagedPosts } from '~/spec'

import { articleKeys, viewerKeys } from '../key'
import { articleUpvoteOperation, patchArticleStatsEverywhere } from './article'
import { clearArticleUpvoteReceipts, readArticleUpvoteReceipt, writeArticleUpvoteReceipt } from './articleReceipt'
import { markChange, rollbackChanges } from './optimistic/effects'
import { executeOptimisticOperation } from './optimistic/execute'
import { enqueueOptimisticToggle } from './optimistic/toggle'

const { browserGraphQLRequest } = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest }))

const article = {
  id: 'db-1',
  innerId: '42',
  community: { slug: 'home' },
  meta: { thread: THREAD.POST },
  articleStats: {
    community: 'home',
    thread: THREAD.POST,
    innerId: '42',
    views: 10,
    viewsRevision: 1,
    upvotesCount: 3,
    commentsCount: 2,
    snapshotAt: new Date().toISOString(),
  },
} as TArticle

const path = { community: 'home', thread: THREAD.POST, innerId: '42' }
const postsKey = articleKeys.posts({ community: 'home' })
const detailKey = articleKeys.detail('home', THREAD.POST, '42')
const statsKey = articleKeys.articleStats('home', THREAD.POST, '42')
const viewerKey = viewerKeys.articleStates('alice', ['home:POST:42'])

const setupClient = () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData<TPagedPosts>(postsKey, { entries: [article] } as TPagedPosts)
  queryClient.setQueryData(detailKey, article)
  queryClient.setQueryData(statsKey, article.articleStats)
  queryClient.setQueryData(viewerKey, {
    'home:POST:42': { articleKey: 'home:POST:42', viewerHasUpvoted: false },
  })
  return queryClient
}

const executeArticleUpvote = (
  queryClient: QueryClient,
  target: TArticle,
  nextState: boolean,
  accountRef = 'alice',
) =>
  executeOptimisticOperation({
    queryClient,
    accountRef,
    operation: articleUpvoteOperation,
    target,
    input: nextState,
  })

const queueArticleUpvoteToggle = (
  queryClient: QueryClient,
  target: TArticle,
  accountRef = 'alice',
) =>
  enqueueOptimisticToggle({
    queryClient,
    accountRef,
    operation: articleUpvoteOperation,
    target,
  })

describe('article query mutation helpers', () => {
  beforeEach(() => {
    browserGraphQLRequest.mockReset()
    clearArticleUpvoteReceipts('alice')
    clearArticleUpvoteReceipts('bob')
  })

  it('patches the normalized ArticleStats entity without touching other cache domains', () => {
    const queryClient = setupClient()
    queryClient.setQueryData(['community'], { title: 'Home' })
    const tagGroupsKey = articleKeys.tagGroups('home', THREAD.POST)
    queryClient.setQueryData(tagGroupsKey, article)

    patchArticleStatsEverywhere(queryClient, path, (current) => ({ ...current, upvotesCount: 4 }))

    expect(queryClient.getQueryData<typeof article.articleStats>(statsKey)?.upvotesCount).toBe(4)
    expect(queryClient.getQueryData<TArticle>(detailKey)?.articleStats?.upvotesCount).toBe(3)
    expect(queryClient.getQueryData(['community'])).toEqual({ title: 'Home' })
    expect(queryClient.getQueryData<TArticle>(tagGroupsKey)?.articleStats?.upvotesCount).toBe(3)
  })

  it('uses the server-confirmed count and viewer state', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest.mockResolvedValue({
      upvotePost: { innerId: '42', articleStats: { upvotesCount: 9 }, viewerHasUpvoted: true },
    })

    await executeArticleUpvote(queryClient, article, true)

    expect(queryClient.getQueryData<typeof article.articleStats>(statsKey)?.upvotesCount).toBe(3)
    expect(readArticleUpvoteReceipt('alice', 'home:POST:42')?.publicProjection.upvotesCount).toBe(9)
    expect(
      queryClient.getQueryData<Record<string, { viewerHasUpvoted: boolean }>>(viewerKey)?.[
        'home:POST:42'
      ].viewerHasUpvoted,
    ).toBe(true)
  })

  it('reconciles the complete Article reaction projection', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest.mockResolvedValue({
      upvotePost: {
        innerId: '42',
        articleStats: { upvotesCount: 9 },
        collectsCount: 4,
        viewerHasUpvoted: true,
        viewerHasCollected: false,
        viewerEmotion: null,
        articleInteractionRevision: 12,
        emotions: [{ type: 'HEART', count: 2, latestUsers: [] }],
        meta: { latestUpvotedUsers: [{ login: 'alice', nickname: 'Alice', avatar: '/a.png' }] },
      },
    })

    await executeArticleUpvote(queryClient, article, true)

    expect(queryClient.getQueryData<typeof article.articleStats>(statsKey)?.upvotesCount).toBe(3)
    expect(queryClient.getQueryData<TArticle>(detailKey)).toMatchObject({
      articleStats: { upvotesCount: 3 },
    })
  })

  it('does not execute an already-confirmed set-state intent', async () => {
    const queryClient = setupClient()
    queryClient.setQueryData(viewerKey, {
      'home:POST:42': { articleKey: 'home:POST:42', viewerHasUpvoted: true },
    })

    await expect(
      enqueueOptimisticToggle({
        queryClient,
        accountRef: 'alice',
        operation: articleUpvoteOperation,
        target: article,
        next: true,
      }),
    ).resolves.toBeUndefined()

    expect(browserGraphQLRequest).not.toHaveBeenCalled()
    expect(queryClient.getQueryData<TArticle>(detailKey)?.articleStats?.upvotesCount).toBe(3)
  })

  it('rolls back viewer state and leaves public count to authority refetch on failure', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest.mockImplementationOnce(() => {
      throw new Error('network')
    })

    await expect(executeArticleUpvote(queryClient, article, true)).rejects.toThrow('network')

    // Public aggregate rollback is delegated to the active authority query;
    // this isolated cache has no queryFn, so it remains optimistic here.
    expect(queryClient.getQueryData<TPagedPosts>(postsKey)?.entries[0].articleStats?.upvotesCount).toBe(3)
    expect(queryClient.getQueryData<typeof article.articleStats>(statsKey)?.upvotesCount).toBe(3)
    expect(
      queryClient.getQueryData<Record<string, { viewerHasUpvoted: boolean }>>(viewerKey)?.[
        'home:POST:42'
      ].viewerHasUpvoted,
    ).toBe(false)
  })

  it('uses the current cached revision instead of a stale Article prop for optimistic count', async () => {
    const queryClient = setupClient()
    const current = {
      ...article,
      articleStats: { ...article.articleStats, upvotesCount: 20 },
      articleInteractionRevision: 43,
    }
    queryClient.setQueryData(postsKey, { entries: [current] } as TPagedPosts)
    queryClient.setQueryData(detailKey, current)
    queryClient.setQueryData(statsKey, current.articleStats)
    writeArticleUpvoteReceipt({
      accountRef: 'alice',
      entityKey: 'home:POST:42',
      commandId: 'old-confirmation',
      upvotesCount: 10,
      viewerHasUpvoted: false,
      articleInteractionRevision: 42,
    })
    browserGraphQLRequest.mockResolvedValue({
      upvotePost: {
        innerId: '42',
        articleStats: { upvotesCount: 21 },
        articleInteractionRevision: 44,
        viewerHasUpvoted: true,
      },
    })

    await executeArticleUpvote(queryClient, article, true)

    expect(queryClient.getQueryData<typeof article.articleStats>(statsKey)?.upvotesCount).toBe(20)
    expect(readArticleUpvoteReceipt('alice', 'home:POST:42')?.publicProjection.upvotesCount).toBe(21)
  })

  it('does not restore an older optimistic value after a newer operation owns the field', () => {
    const queryClient = setupClient()
    const firstContext = { queryClient, accountRef: 'alice', commandId: 'op-first' }
    const secondContext = { queryClient, accountRef: 'alice', commandId: 'op-second' }
    const first = articleUpvoteOperation.apply(firstContext, article, true)
    for (const change of first.changes) markChange(queryClient, change)
    const second = articleUpvoteOperation.apply(secondContext, article, false)
    for (const change of second.changes) markChange(queryClient, change)

    rollbackChanges(queryClient, first.changes)

    expect(queryClient.getQueryData<typeof article.articleStats>(statsKey)?.upvotesCount).toBe(3)
    expect(
      queryClient.getQueryData<Record<string, { viewerHasUpvoted: boolean }>>(viewerKey)?.[
        'home:POST:42'
      ].viewerHasUpvoted,
    ).toBe(false)
  })

  it('leaves public aggregate rollback to the authority refetch path', () => {
    const queryClient = setupClient()
    const context = { queryClient, accountRef: 'alice', commandId: 'op-count' }
    const plan = articleUpvoteOperation.apply(context, article, true)
    for (const change of plan.changes) markChange(queryClient, change)

    rollbackChanges(queryClient, plan.changes)

    // Public ArticleStats is unchanged until the authority refetch completes.
    expect(queryClient.getQueryData<typeof article.articleStats>(statsKey)?.upvotesCount).toBe(3)
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
    browserGraphQLRequest.mockResolvedValue({
      upvoteDoc: { innerId: '42', articleStats: { upvotesCount: 5 }, viewerHasUpvoted: true },
    })

    await expect(executeArticleUpvote(queryClient, docArticle, true)).resolves.toBeDefined()

    expect(browserGraphQLRequest).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData<typeof article.articleStats>(statsKey)?.upvotesCount).toBeUndefined()
  })

  it('coalesces rapid toggles to the last intent and removes command mutations', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest
      .mockResolvedValueOnce({
        upvotePost: { innerId: '42', articleStats: { upvotesCount: 4 }, viewerHasUpvoted: true },
      })
      .mockResolvedValueOnce({
        undoUpvotePost: { innerId: '42', articleStats: { upvotesCount: 3 }, viewerHasUpvoted: false },
      })

    const first = queueArticleUpvoteToggle(queryClient, article)
    const second = queueArticleUpvoteToggle(queryClient, article)
    await Promise.all([first, second])

    expect(browserGraphQLRequest).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData<typeof article.articleStats>(statsKey)?.upvotesCount).toBe(3)
    expect(
      queryClient.getQueryData<Record<string, { viewerHasUpvoted: boolean }>>(viewerKey)?.[
        'home:POST:42'
      ].viewerHasUpvoted,
    ).toBe(false)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it('collapses three rapid toggles into the first in-flight target', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest.mockResolvedValue({
      upvotePost: { innerId: '42', articleStats: { upvotesCount: 4 }, viewerHasUpvoted: true },
    })

    const first = queueArticleUpvoteToggle(queryClient, article)
    const second = queueArticleUpvoteToggle(queryClient, article)
    const third = queueArticleUpvoteToggle(queryClient, article)
    await Promise.all([first, second, third])

    expect(browserGraphQLRequest).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData<typeof article.articleStats>(statsKey)?.upvotesCount).toBe(3)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it('keeps in-flight intents isolated by viewer', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest.mockResolvedValue({
      upvotePost: { innerId: '42', upvotesCount: 4, viewerHasUpvoted: true },
    })

    await Promise.all([
      queueArticleUpvoteToggle(queryClient, article, 'alice'),
      queueArticleUpvoteToggle(queryClient, article, 'bob'),
    ])

    expect(browserGraphQLRequest).toHaveBeenCalledTimes(2)
  })
})
