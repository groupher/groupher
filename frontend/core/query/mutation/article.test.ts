import { QueryClient } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import type { TArticle, TPagedPosts } from '~/spec'

import { articleQueryKeys, viewerQueryKeys } from '../key'
import { articleUpvoteOperation } from './article'
import { setArticleCollected } from './article/collect'
import { setArticleEmotion } from './article/emotion'
import {
  clearArticleUpvoteReceipts,
  readArticleUpvoteReceipt,
  writeArticleUpvoteReceipt,
} from './articleReceipt'
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
} as TArticle

const stats = {
  community: 'home',
  thread: THREAD.POST,
  innerId: '42',
  views: 10,
  viewsRevision: 1,
  upvotesCount: 3,
  commentsCount: 2,
  collectsCount: 0,
  commentsParticipantsCount: 0,
  interactionRevision: 0,
  commentsRevision: 0,
  emotionCounts: [],
  snapshotAt: new Date().toISOString(),
}

const postsKey = articleQueryKeys.posts({ community: 'home' })
const detailKey = articleQueryKeys.detail('home', THREAD.POST, '42')
const statsKey = articleQueryKeys.stats('home', THREAD.POST, '42')
const viewerKey = viewerQueryKeys.articleInteractionStates('alice', ['home:POST:42'])

const reactionResult = (viewerHasUpvoted: boolean, overrides: Partial<typeof stats> = {}) => ({
  commandId: 'command-1',
  reactionOutcome: 'CHANGED' as const,
  articleStats: {
    ...stats,
    upvotesCount: viewerHasUpvoted ? 4 : 3,
    interactionRevision: stats.interactionRevision + 1,
    ...overrides,
  },
  interactionState: {
    community: 'home',
    thread: THREAD.POST,
    innerId: '42',
    interactionRevision: overrides.interactionRevision ?? stats.interactionRevision + 1,
    viewerHasUpvoted,
    viewerHasCollected: false,
    viewerEmotion: null,
  },
})

const setupClient = () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData<TPagedPosts>(postsKey, { entries: [article] } as TPagedPosts)
  queryClient.setQueryData(detailKey, article)
  queryClient.setQueryData(statsKey, stats)
  queryClient.setQueryData(viewerKey, {
    'home:POST:42': {
      articleKey: 'home:POST:42',
      community: 'home',
      thread: THREAD.POST,
      innerId: '42',
      interactionRevision: 0,
      viewerHasUpvoted: false,
      viewerHasCollected: false,
      viewerEmotion: null,
    },
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

  it('applies committed ArticleStats and interaction state from the mutation payload', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest.mockResolvedValue({
      upvotePost: reactionResult(true),
    })

    await executeArticleUpvote(queryClient, article, true)

    expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(4)
    expect(readArticleUpvoteReceipt('alice', 'home:POST:42')?.viewerState.viewerHasUpvoted).toBe(
      true,
    )
    expect(
      queryClient.getQueryData<Record<string, { viewerHasUpvoted: boolean }>>(viewerKey)?.[
        'home:POST:42'
      ].viewerHasUpvoted,
    ).toBe(true)
  })

  it('keeps the private revision on receipts when post-commit owner reads are skewed', async () => {
    const queryClient = setupClient()
    const result = reactionResult(true, { interactionRevision: 21 })
    result.interactionState.interactionRevision = 20
    browserGraphQLRequest.mockResolvedValue({ upvotePost: result })

    await executeArticleUpvote(queryClient, article, true)

    expect(queryClient.getQueryData<typeof stats>(statsKey)?.interactionRevision).toBe(21)
    expect(
      queryClient.getQueryData<Record<string, { interactionRevision: number }>>(viewerKey)?.[
        'home:POST:42'
      ].interactionRevision,
    ).toBe(20)
    expect(readArticleUpvoteReceipt('alice', 'home:POST:42')?.interactionRevision).toBe(20)
  })

  it('cancels only stats and interaction queries that contain the target path', () => {
    const queryClient = setupClient()
    const targetBatch = articleQueryKeys.statsBatch('home', THREAD.POST, ['7', '42'])
    const unrelatedStats = articleQueryKeys.stats('home', THREAD.POST, '7')
    const unrelatedBatch = articleQueryKeys.statsBatch('acme', THREAD.POST, ['42'])
    const targetViewerBatch = viewerQueryKeys.articleInteractionStates('alice', [
      'home:POST:7',
      'home:POST:42',
    ])
    const unrelatedViewerBatch = viewerQueryKeys.articleInteractionStates('alice', ['home:POST:7'])

    queryClient.setQueryData(targetBatch, [stats])
    queryClient.setQueryData(unrelatedStats, { ...stats, innerId: '7' })
    queryClient.setQueryData(unrelatedBatch, [{ ...stats, community: 'acme' }])
    queryClient.setQueryData(targetViewerBatch, {})
    queryClient.setQueryData(unrelatedViewerBatch, {})

    const targets = articleUpvoteOperation.queriesToCancel(
      { queryClient, accountRef: 'alice', commandId: 'command-1' },
      article,
    )
    const keys = targets.map(({ queryKey }) => queryKey)

    expect(keys).toContainEqual(statsKey)
    expect(keys).toContainEqual(targetBatch)
    expect(keys).toContainEqual(viewerKey)
    expect(keys).toContainEqual(targetViewerBatch)
    expect(keys).not.toContainEqual(unrelatedStats)
    expect(keys).not.toContainEqual(unrelatedBatch)
    expect(keys).not.toContainEqual(unrelatedViewerBatch)
  })

  it('does not write aggregate fields into the Article content cache', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest.mockResolvedValue({
      upvotePost: reactionResult(true, { upvotesCount: 9, interactionRevision: 12 }),
    })

    await executeArticleUpvote(queryClient, article, true)

    expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(9)
    expect(queryClient.getQueryData<TArticle>(detailKey)).toEqual(article)
  })

  it('does not execute an already-confirmed set-state intent', async () => {
    const queryClient = setupClient()
    queryClient.setQueryData(viewerKey, {
      'home:POST:42': {
        articleKey: 'home:POST:42',
        community: 'home',
        thread: THREAD.POST,
        innerId: '42',
        interactionRevision: 1,
        viewerHasUpvoted: true,
        viewerHasCollected: false,
        viewerEmotion: null,
      },
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
    expect(queryClient.getQueryData<TArticle>(detailKey)).toEqual(article)
  })

  it('rolls back viewer state without touching public stats on failure', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest.mockImplementationOnce(() => {
      throw new Error('network')
    })

    await expect(executeArticleUpvote(queryClient, article, true)).rejects.toThrow('network')

    expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(3)
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
    }
    const currentStats = { ...stats, upvotesCount: 20 }
    queryClient.setQueryData(postsKey, { entries: [current] } as TPagedPosts)
    queryClient.setQueryData(detailKey, current)
    queryClient.setQueryData(statsKey, currentStats)
    writeArticleUpvoteReceipt({
      accountRef: 'alice',
      entityKey: 'home:POST:42',
      commandId: 'old-confirmation',
      viewerHasUpvoted: false,
      interactionRevision: 42,
    })
    browserGraphQLRequest.mockResolvedValue({
      upvotePost: reactionResult(true, { upvotesCount: 21, interactionRevision: 44 }),
    })

    await executeArticleUpvote(queryClient, article, true)

    expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(21)
    expect(readArticleUpvoteReceipt('alice', 'home:POST:42')?.interactionRevision).toBe(44)
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

    expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(3)
    expect(
      queryClient.getQueryData<Record<string, { viewerHasUpvoted: boolean }>>(viewerKey)?.[
        'home:POST:42'
      ].viewerHasUpvoted,
    ).toBe(false)
  })

  it('keeps public stats unchanged during the optimistic phase', () => {
    const queryClient = setupClient()
    const context = { queryClient, accountRef: 'alice', commandId: 'op-count' }
    const plan = articleUpvoteOperation.apply(context, article, true)
    for (const change of plan.changes) markChange(queryClient, change)

    rollbackChanges(queryClient, plan.changes)

    expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(3)
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
    const docKey = articleQueryKeys.detail('home', THREAD.DOC, '42')
    queryClient.setQueryData(docKey, docArticle)
    browserGraphQLRequest.mockResolvedValue({
      upvoteDoc: reactionResult(true),
    })

    await expect(executeArticleUpvote(queryClient, docArticle, true)).resolves.toBeDefined()

    expect(browserGraphQLRequest).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBeUndefined()
  })

  it('coalesces rapid toggles to the last intent and removes command mutations', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest
      .mockResolvedValueOnce({
        upvotePost: reactionResult(true),
      })
      .mockResolvedValueOnce({
        undoUpvotePost: reactionResult(false, { interactionRevision: 2 }),
      })

    const first = queueArticleUpvoteToggle(queryClient, article)
    const second = queueArticleUpvoteToggle(queryClient, article)
    await Promise.all([first, second])

    expect(browserGraphQLRequest).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(3)
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
      upvotePost: reactionResult(true),
    })

    const first = queueArticleUpvoteToggle(queryClient, article)
    const second = queueArticleUpvoteToggle(queryClient, article)
    const third = queueArticleUpvoteToggle(queryClient, article)
    await Promise.all([first, second, third])

    expect(browserGraphQLRequest).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(4)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it('keeps in-flight intents isolated by viewer', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest.mockResolvedValue({
      upvotePost: reactionResult(true),
    })

    await Promise.all([
      queueArticleUpvoteToggle(queryClient, article, 'alice'),
      queueArticleUpvoteToggle(queryClient, article, 'bob'),
    ])

    expect(browserGraphQLRequest).toHaveBeenCalledTimes(2)
  })

  it('applies collect stats and interaction state from the dedicated payload', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest.mockResolvedValue({
      addToCollect: {
        ...reactionResult(true, { collectsCount: 1, interactionRevision: 1 }),
        folder: { id: 'folder-1', title: 'Saved' },
        interactionState: {
          ...reactionResult(true).interactionState,
          viewerHasUpvoted: false,
          viewerHasCollected: true,
        },
      },
    })

    const result = await setArticleCollected(
      queryClient,
      'alice',
      article,
      'folder-1',
      true,
      'collect-command',
    )

    expect(result.folder).toMatchObject({ id: 'folder-1' })
    expect(queryClient.getQueryData<typeof stats>(statsKey)?.collectsCount).toBe(1)
    expect(
      queryClient.getQueryData<Record<string, { viewerHasCollected: boolean }>>(viewerKey)?.[
        'home:POST:42'
      ].viewerHasCollected,
    ).toBe(true)
  })

  it('applies emotion stats and interaction state from the dedicated payload', async () => {
    const queryClient = setupClient()
    browserGraphQLRequest.mockResolvedValue({
      emotionToPost: {
        ...reactionResult(false, {
          emotionCounts: [{ type: 'HEART', count: 1 }],
          interactionRevision: 1,
        }),
        interactionState: {
          ...reactionResult(false).interactionState,
          viewerEmotion: 'HEART',
        },
      },
    })

    await setArticleEmotion(queryClient, 'alice', article, 'heart', true, 'emotion-command')

    expect(queryClient.getQueryData<typeof stats>(statsKey)?.emotionCounts).toEqual([
      { type: 'HEART', count: 1 },
    ])
    expect(
      queryClient.getQueryData<Record<string, { viewerEmotion: string | null }>>(viewerKey)?.[
        'home:POST:42'
      ].viewerEmotion,
    ).toBe('HEART')
  })
})
