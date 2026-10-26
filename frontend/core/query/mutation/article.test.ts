import { QueryClient, QueryObserver } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import type { TArticle, TPagedPosts } from '~/spec'

import { articleStats, articleStatsBatch } from '../articleStats'
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

const postsKey = articleQueryKeys.pagiPosts({ community: 'home' })
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
  accountScope = 'alice',
) =>
  executeOptimisticOperation({
    queryClient,
    accountScope,
    operation: articleUpvoteOperation,
    target,
    input: nextState,
  })

const queueArticleUpvoteToggle = (
  queryClient: QueryClient,
  target: TArticle,
  accountScope = 'alice',
) =>
  enqueueOptimisticToggle({
    queryClient,
    accountScope,
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
      { queryClient, accountScope: 'alice', commandId: 'command-1' },
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
        accountScope: 'alice',
        operation: articleUpvoteOperation,
        target: article,
        next: true,
      }),
    ).resolves.toBeUndefined()

    expect(browserGraphQLRequest).not.toHaveBeenCalled()
    expect(queryClient.getQueryData<TArticle>(detailKey)).toEqual(article)
  })

  it('rolls back viewer state and refetches the public count on failure', async () => {
    const queryClient = setupClient()
    const statsQuery = vi.fn(async () => stats)
    const observer = new QueryObserver(queryClient, {
      ...articleStats(queryClient, 'home', THREAD.POST, '42'),
      queryFn: statsQuery,
      staleTime: Number.POSITIVE_INFINITY,
    })
    const unsubscribe = observer.subscribe(() => undefined)
    const requestError = new Error('network')
    browserGraphQLRequest.mockImplementationOnce(() => {
      throw requestError
    })

    try {
      await expect(executeArticleUpvote(queryClient, article, true)).rejects.toBe(requestError)
      expect(requestError.message).toBe('network')
    } finally {
      unsubscribe()
    }

    expect(statsQuery).toHaveBeenCalledOnce()
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
      accountScope: 'alice',
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
    const firstContext = { queryClient, accountScope: 'alice', commandId: 'op-first' }
    const secondContext = { queryClient, accountScope: 'alice', commandId: 'op-second' }
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

  it('does not restore viewer state after its authority revision advances', () => {
    const queryClient = setupClient()
    const context = { queryClient, accountScope: 'alice', commandId: 'op-stale-viewer' }
    const plan = articleUpvoteOperation.apply(context, article, true)
    for (const change of plan.changes) markChange(queryClient, change)

    queryClient.setQueryData<Record<string, TArticleInteractionState>>(viewerKey, (current) => ({
      ...current,
      'home:POST:42': {
        ...current!['home:POST:42'],
        interactionRevision: 2,
        viewerHasUpvoted: true,
      },
    }))
    rollbackChanges(queryClient, plan.changes)

    expect(
      queryClient.getQueryData<Record<string, TArticleInteractionState>>(viewerKey)?.[
        'home:POST:42'
      ],
    ).toMatchObject({ interactionRevision: 2, viewerHasUpvoted: true })
  })

  it('optimistically increments the active public count and private viewer state', async () => {
    const queryClient = setupClient()
    const observer = new QueryObserver(queryClient, {
      ...articleStats(queryClient, 'home', THREAD.POST, '42'),
      queryFn: async () => stats,
      staleTime: Number.POSITIVE_INFINITY,
    })
    const unsubscribe = observer.subscribe(() => undefined)
    let resolveRequest: (value: unknown) => void = () => undefined
    browserGraphQLRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        }),
    )

    try {
      const pending = executeArticleUpvote(queryClient, article, true)

      await vi.waitFor(() => {
        expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(4)
        expect(
          queryClient.getQueryData<Record<string, { viewerHasUpvoted: boolean }>>(viewerKey)?.[
            'home:POST:42'
          ].viewerHasUpvoted,
        ).toBe(true)
      })

      resolveRequest({ upvotePost: reactionResult(true) })
      await pending
    } finally {
      unsubscribe()
    }

    expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(4)
  })

  it('optimistically updates only the target entry in an active stats batch', () => {
    const queryClient = setupClient()
    const batchKey = articleQueryKeys.statsBatch('home', THREAD.POST, ['7', '42'])
    const otherStats = { ...stats, innerId: '7', upvotesCount: 8 }
    queryClient.setQueryData(batchKey, [otherStats, stats])
    const observer = new QueryObserver(queryClient, {
      ...articleStatsBatch(queryClient, 'home', THREAD.POST, ['7', '42']),
      queryFn: async () => [otherStats, stats],
      staleTime: Number.POSITIVE_INFINITY,
    })
    const unsubscribe = observer.subscribe(() => undefined)
    const context = { queryClient, accountScope: 'alice', commandId: 'op-batch-count' }

    articleUpvoteOperation.apply(context, article, true)
    unsubscribe()

    const batch = queryClient.getQueryData<(typeof stats)[]>(batchKey)

    expect(batch?.find(({ innerId }) => innerId === '42')?.upvotesCount).toBe(4)
    expect(batch?.find(({ innerId }) => innerId === '7')?.upvotesCount).toBe(8)
  })

  it('marks an inactive optimistic count stale after the mutation fails', async () => {
    const queryClient = setupClient()
    const statsQuery = vi.fn(async () => stats)
    const observer = new QueryObserver(queryClient, {
      ...articleStats(queryClient, 'home', THREAD.POST, '42'),
      queryFn: statsQuery,
      staleTime: Number.POSITIVE_INFINITY,
    })
    const unsubscribe = observer.subscribe(() => undefined)
    let rejectRequest: (reason: Error) => void = () => undefined
    browserGraphQLRequest.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject
        }),
    )
    const pending = executeArticleUpvote(queryClient, article, true)

    await vi.waitFor(() =>
      expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(4),
    )
    unsubscribe()
    const requestError = new Error('network')
    rejectRequest(requestError)

    await expect(pending).rejects.toBe(requestError)
    expect(requestError.message).toBe('network')
    expect(queryClient.getQueryState(statsKey)?.isInvalidated).toBe(true)

    const remount = new QueryObserver(queryClient, {
      ...articleStats(queryClient, 'home', THREAD.POST, '42'),
      queryFn: statsQuery,
      staleTime: Number.POSITIVE_INFINITY,
    })
    const unsubscribeRemount = remount.subscribe(() => undefined)
    try {
      await vi.waitFor(() => expect(statsQuery).toHaveBeenCalledOnce())
      await vi.waitFor(() => expect(remount.getCurrentResult().fetchStatus).toBe('idle'))
      await vi.waitFor(() =>
        expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(3),
      )
    } finally {
      unsubscribeRemount()
    }
  })

  it('optimistically decrements the current count for an undo intent', () => {
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
    const observer = new QueryObserver(queryClient, {
      queryKey: statsKey,
      queryFn: async () => stats,
      staleTime: Number.POSITIVE_INFINITY,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    articleUpvoteOperation.apply(
      { queryClient, accountScope: 'alice', commandId: 'op-undo-count' },
      article,
      false,
    )
    unsubscribe()

    expect(queryClient.getQueryData<typeof stats>(statsKey)?.upvotesCount).toBe(2)
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
