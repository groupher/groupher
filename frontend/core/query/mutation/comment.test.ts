import { QueryClient } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import type { TCommentViewerStates } from '~/lib/commentViewerState'
import { plateSourceFromJson, publishContentCommand } from '~/lib/contentPublisher'
import { DEFAULT_EFFECTIVE_PAGI_CONFIG } from '~/lib/pagination/params'
import type { TComment } from '~/spec'

import { commentQueries } from '../comment'
import { articleQueryKeys, commentKeys, viewerQueryKeys } from '../key'
import {
  commentUpvoteOperation,
  deleteCommentOperation,
  createCommentOperation,
  insertPendingComment,
  patchCommentEverywhere,
  patchCommentViewerState,
  reconcileCreatedComment,
  updateCommentOperation,
  updateCommentEmotion,
  replyCommentOperation,
} from './comment'
import { markChange, rollbackChanges } from './optimistic/effects'
import { executeOptimisticOperation } from './optimistic/execute'

vi.mock('~/lib/contentPublisher', () => ({
  plateSourceFromJson: vi.fn(() => ({ format: 'plate', value: [] })),
  publishContentCommand: vi.fn(),
}))

const root = {
  innerId: '1',
  replies: [{ innerId: '2', upvotesCount: 1, replies: [] }],
  emotions: [{ type: 'HEART', count: 0, viewerHasReacted: false }],
} as TComment
const key = commentKeys.list('home', THREAD.POST, '42')
const otherArticleKey = commentKeys.list('home', THREAD.POST, '99')
const scope = { community: 'home', thread: THREAD.POST, articleInnerId: '42' }
const articleStats = {
  community: 'home',
  thread: THREAD.POST,
  innerId: '42',
  views: 10,
  viewsRevision: 1,
  upvotesCount: 2,
  commentsCount: 8,
  collectsCount: 1,
  commentsParticipants: [],
  commentsParticipantsCount: 3,
  interactionRevision: 2,
  commentsRevision: 2,
  emotionCounts: [],
  snapshotAt: new Date().toISOString(),
}

describe('comment query mutation helpers', () => {
  it('keeps cancellation and authority target contracts separate', () => {
    const queryClient = new QueryClient()
    const viewerKey = viewerQueryKeys.commentStates('alice', 'home:POST:42', ['1'])
    queryClient.setQueryData(key, { entries: [root] })
    queryClient.setQueryData(viewerKey, { '1': { viewerHasUpvoted: false, emotionFlags: {} } })
    const target = {
      comment: root,
      scope,
      articlePath: { community: 'home', thread: THREAD.POST, innerId: '42' },
      articleKey: 'home:POST:42',
      commentInnerId: '1',
      commentPath: {
        article: { community: 'home', thread: THREAD.POST, innerId: '42' },
        innerId: '1',
      },
    }
    const context = { queryClient, accountScope: 'alice', commandId: 'targets' }
    const cancelTargets = commentUpvoteOperation.queriesToCancel(context, target)
    const authorityTargets = commentUpvoteOperation.authorityTargets(context, target)

    expect(cancelTargets.map(({ queryKey }) => queryKey)).toEqual(
      authorityTargets.map(({ queryKey }) => queryKey),
    )
    expect(cancelTargets.every(({ exact }) => exact === true)).toBe(true)
    expect(authorityTargets.every((authorityTarget) => !('exact' in authorityTarget))).toBe(true)
  })

  it('keeps lifecycle authority targets free of cancellation filters', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(key, { entries: [root] })
    const target = {
      comment: root,
      scope,
      articlePath: { community: 'home', thread: THREAD.POST, innerId: '42' },
      articleKey: 'home:POST:42',
      commentInnerId: '1',
      commentPath: {
        article: { community: 'home', thread: THREAD.POST, innerId: '42' },
        innerId: '1',
      },
    }
    const context = { queryClient, accountScope: 'alice', commandId: 'lifecycle-targets' }

    const updateTargets = updateCommentOperation.authorityTargets(context, target, 'updated')
    const deleteTargets = deleteCommentOperation.authorityTargets(context, target, undefined)
    expect(updateTargets.every((authorityTarget) => !('exact' in authorityTarget))).toBe(true)
    expect(deleteTargets.every((authorityTarget) => !('exact' in authorityTarget))).toBe(true)
  })

  it('patches a nested reply across loaded comment lists', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(key, { entries: [root], totalCount: 2 })

    patchCommentEverywhere(queryClient, scope, '2', (comment) => ({ ...comment, upvotesCount: 2 }))

    const data = queryClient.getQueryData<{ entries: TComment[] }>(key)
    expect(data?.entries[0].replies[0].upvotesCount).toBe(2)
  })

  it('inserts and rolls back a temporary root comment', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(key, { entries: [root], totalCount: 1, pageNumber: 1 })
    const pending = { innerId: 'pending:1', replies: [] } as TComment

    insertPendingComment(queryClient, scope, pending)
    expect(
      queryClient.getQueryData<{ entries: TComment[]; totalCount: number }>(key),
    ).toMatchObject({
      totalCount: 1,
      entries: [{ innerId: '1' }, { innerId: 'pending:1' }],
    })
    patchCommentEverywhere(queryClient, scope, pending.innerId, () => null)
    expect(queryClient.getQueryData<{ entries: TComment[] }>(key)?.entries).toHaveLength(1)
  })

  it('never lets an emotion count become negative', () => {
    const emotion = updateCommentEmotion(root, 'heart', false).emotions[0]

    expect(emotion).toMatchObject({ count: 0 })
    expect(emotion).not.toHaveProperty('viewerHasReacted')
  })

  it('patches viewer flags without changing the public comment cache', () => {
    const queryClient = new QueryClient()
    const viewerKey = viewerQueryKeys.commentStates('alice', 'home:POST:42', ['1'])
    queryClient.setQueryData(key, { entries: [root], totalCount: 1 })
    queryClient.setQueryData<TCommentViewerStates>(viewerKey, {
      '1': { emotionFlags: { HEART: false }, viewerHasUpvoted: false },
    })

    patchCommentViewerState(queryClient, 'alice', 'home:POST:42', '1', (state) => ({
      ...state,
      emotionFlags: { ...state.emotionFlags, HEART: true },
      viewerHasUpvoted: true,
    }))

    expect(queryClient.getQueryData<TCommentViewerStates>(viewerKey)?.['1']).toEqual({
      emotionFlags: { HEART: true },
      viewerHasUpvoted: true,
    })
    expect(queryClient.getQueryData<{ entries: TComment[] }>(key)?.entries[0]).toBe(root)
  })

  it('does not patch a same-innerId comment from another article', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(key, { entries: [root] })
    queryClient.setQueryData(otherArticleKey, {
      entries: [{ ...root, upvotesCount: 10 }],
    })

    patchCommentEverywhere(queryClient, scope, '1', (comment) => ({
      ...comment,
      upvotesCount: 2,
    }))

    expect(queryClient.getQueryData<{ entries: TComment[] }>(key)?.entries[0].upvotesCount).toBe(2)
    expect(
      queryClient.getQueryData<{ entries: TComment[] }>(otherArticleKey)?.entries[0].upvotesCount,
    ).toBe(10)
  })

  it('replaces a pending comment without invalidating ArticleStats', () => {
    const queryClient = new QueryClient()
    const articleStatsKey = articleQueryKeys.stats('home', THREAD.POST, '42')
    queryClient.setQueryData(articleStatsKey, articleStats)
    queryClient.setQueryData(key, {
      entries: [{ ...root, innerId: 'pending:1' }],
      totalCount: 1,
    })

    reconcileCreatedComment(queryClient, scope, 'pending:1', { ...root, innerId: 'confirmed-1' })

    expect(queryClient.getQueryState(articleStatsKey)?.isInvalidated).toBe(false)
    expect(queryClient.getQueryData<{ entries: TComment[] }>(key)?.entries[0].innerId).toBe(
      'confirmed-1',
    )
  })

  it('restores a deleted entity at its original slot when the operation fails', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(key, { entries: [root], totalCount: 1 })
    const target = {
      comment: root,
      scope,
      articlePath: { community: 'home', thread: THREAD.POST, innerId: '42' },
      articleKey: 'home:POST:42',
      commentInnerId: '1',
      commentPath: {
        article: { community: 'home', thread: THREAD.POST, innerId: '42' },
        innerId: '1',
      },
    }
    const context = { queryClient, accountScope: 'alice', commandId: 'op-1' }
    const plan = deleteCommentOperation.prepare(context, target)

    for (const change of plan.changes) markChange(queryClient, change)
    for (const change of plan.changes) change.commit()
    expect(queryClient.getQueryData<{ entries: TComment[] }>(key)?.entries).toEqual([])

    rollbackChanges(queryClient, plan.changes)
    expect(queryClient.getQueryData<{ entries: TComment[] }>(key)?.entries[0].innerId).toBe('1')
  })

  it('prepares reply changes without writes and still sends when a real cached shape is malformed', async () => {
    const queryClient = new QueryClient()
    const listKey = commentKeys.list('home', THREAD.POST, '42')
    const malformedKey = commentQueries.infinite(
      { article: { community: 'home', thread: THREAD.POST, innerId: '42' }, mode: 'REPLIES' },
      DEFAULT_EFFECTIVE_PAGI_CONFIG,
    ).queryKey
    const original = { entries: [root], totalCount: 1 }
    const malformed = { pages: [{ entries: [null] }], pageParams: [undefined] }
    queryClient.setQueryData(listKey, original)
    queryClient.setQueryData(malformedKey, malformed)
    vi.mocked(publishContentCommand).mockResolvedValueOnce({
      commandId: 'reply-command',
      comment: { ...root, innerId: 'confirmed-reply' },
      articleStats,
    })
    const target = {
      scope,
      articlePath: { community: 'home', thread: THREAD.POST, innerId: '42' },
      articleKey: 'home:POST:42',
      parentId: '1',
      parent: root,
    }

    await expect(
      executeOptimisticOperation({
        queryClient,
        accountScope: 'alice',
        operation: replyCommentOperation,
        target,
        input: '[]',
      }),
    ).resolves.toMatchObject({ comment: { innerId: 'confirmed-reply' } })

    expect(publishContentCommand).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData(listKey)).toBe(original)
    expect(queryClient.getQueryData(malformedKey)).toBe(malformed)
    expect(plateSourceFromJson).toHaveBeenCalledWith('[]')
  })

  it.each([
    { failure: 'before structural sharing', landsSecondWrite: false },
    { failure: 'after subscriber notification', landsSecondWrite: true },
  ])(
    'cleans the first comment cache when a later setter throws $failure',
    async ({ landsSecondWrite }) => {
      const queryClient = new QueryClient()
      const firstKey = commentKeys.list('home', THREAD.POST, '42')
      const secondKey = commentQueries.infinite(
        { article: { community: 'home', thread: THREAD.POST, innerId: '42' }, mode: 'TIMELINE' },
        DEFAULT_EFFECTIVE_PAGI_CONFIG,
      ).queryKey
      queryClient.setQueryData(firstKey, { entries: [root], totalCount: 1 })
      queryClient.setQueryData(secondKey, {
        pages: [{ entries: [root], pageInfo: { page: 1, api: 'offset' } }],
        pageParams: [undefined],
      })
      const setQueryData = queryClient.setQueryData.bind(queryClient)
      let writes = 0
      let thrown = false
      queryClient.setQueryData = ((queryKey, updater, options) => {
        writes += 1
        if (writes === 2 && !landsSecondWrite && !thrown) {
          thrown = true
          throw new Error('structural sharing failed before cache write')
        }
        const result = setQueryData(queryKey, updater, options)
        if (writes === 2 && landsSecondWrite && !thrown) {
          thrown = true
          throw new Error('subscriber failed after cache write')
        }
        return result
      }) as typeof queryClient.setQueryData
      vi.mocked(publishContentCommand).mockResolvedValueOnce({
        commandId: 'create-command',
        comment: { ...root, innerId: 'confirmed-comment' },
        articleStats,
      })
      const target = {
        scope,
        articlePath: { community: 'home', thread: THREAD.POST, innerId: '42' },
        articleKey: 'home:POST:42',
      }

      await expect(
        executeOptimisticOperation({
          queryClient,
          accountScope: 'alice',
          operation: createCommentOperation,
          target,
          input: '[]',
        }),
      ).resolves.toMatchObject({ comment: { innerId: 'confirmed-comment' } })

      expect(publishContentCommand).toHaveBeenCalledOnce()
      expect(queryClient.getQueryData<{ entries: TComment[] }>(firstKey)?.entries).toEqual([root])
      expect(
        queryClient.getQueryData<{ pages: { entries: TComment[] }[] }>(secondKey)?.pages[0].entries,
      ).toEqual([root])
    },
  )

  it('reconciles the Article comment revision returned by an update', () => {
    const queryClient = new QueryClient()
    const articleStatsKey = articleQueryKeys.stats('home', THREAD.POST, '42')
    queryClient.setQueryData(articleStatsKey, articleStats)
    const target = {
      comment: root,
      scope,
      articlePath: { community: 'home', thread: THREAD.POST, innerId: '42' },
      articleKey: 'home:POST:42',
      commentInnerId: '1',
      commentPath: {
        article: { community: 'home', thread: THREAD.POST, innerId: '42' },
        innerId: '1',
      },
    }

    updateCommentOperation.reconcile(
      { queryClient, accountScope: 'alice', commandId: 'op-update' },
      target,
      'updated body',
      {
        commandId: 'op-update',
        comment: { ...root, bodyHtml: 'updated body' },
        articleStats: { ...articleStats, commentsRevision: 3 },
      },
    )

    expect(queryClient.getQueryData<typeof articleStats>(articleStatsKey)?.commentsRevision).toBe(3)
    expect(queryClient.getQueryState(articleStatsKey)?.isInvalidated).toBe(false)
  })

  it('publishes the loaded comment body version when updating', async () => {
    vi.mocked(publishContentCommand).mockResolvedValueOnce({
      articleStats,
      commandId: 'op-update',
      comment: root,
    })
    const target = {
      comment: { ...root, bodyVersion: 7 },
      scope,
      articlePath: { community: 'home', thread: THREAD.POST, innerId: '42' },
      articleKey: 'home:POST:42',
      commentInnerId: '1',
      commentPath: {
        article: { community: 'home', thread: THREAD.POST, innerId: '42' },
        innerId: '1',
      },
    }

    await updateCommentOperation.execute(
      { queryClient: new QueryClient(), accountScope: 'alice', commandId: 'op-update' },
      target,
      '[]',
    )

    expect(publishContentCommand).toHaveBeenCalledWith(
      expect.objectContaining({ commandId: 'op-update', expectedVersion: 7 }),
    )
  })

  it('applies returned ArticleStats after delete without invalidation', () => {
    const queryClient = new QueryClient()
    const articleStatsKey = articleQueryKeys.stats('home', THREAD.POST, '42')
    queryClient.setQueryData(articleStatsKey, { ...articleStats, commentsCount: 7 })
    queryClient.setQueryData(key, { entries: [root], totalCount: 1 })
    const target = {
      comment: root,
      scope,
      articlePath: { community: 'home', thread: THREAD.POST, innerId: '42' },
      articleKey: 'home:POST:42',
      commentInnerId: '1',
      commentPath: {
        article: { community: 'home', thread: THREAD.POST, innerId: '42' },
        innerId: '1',
      },
    }

    deleteCommentOperation.reconcile(
      { queryClient, accountScope: 'alice', commandId: 'op-delete' },
      target,
      undefined,
      {
        commandId: 'op-delete',
        comment: root,
        articleStats: { ...articleStats, commentsCount: 6, commentsRevision: 3 },
      },
    )

    expect(queryClient.getQueryData<typeof articleStats>(articleStatsKey)).toMatchObject({
      commentsCount: 6,
      commentsRevision: 3,
    })
    expect(queryClient.getQueryState(articleStatsKey)?.isInvalidated).toBe(false)
    expect(queryClient.getQueryData<{ entries: TComment[] }>(key)?.entries).toEqual([])
  })
})
