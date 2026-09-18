import { QueryClient } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import type { TCommentViewerStates } from '~/lib/commentViewerState'
import type { TComment } from '~/spec'

import { articleKeys, commentKeys, viewerKeys } from '../key'
import { articleQueryTargets } from './article'
import {
  deleteCommentOperation,
  insertPendingComment,
  patchCommentEverywhere,
  patchCommentViewerState,
  reconcileCreatedComment,
  updateCommentOperation,
  updateCommentEmotion,
} from './comment'
import { markChange, rollbackChanges } from './optimistic/effects'

const root = {
  innerId: '1',
  replies: [{ innerId: '2', upvotesCount: 1, replies: [] }],
  emotions: [{ type: 'HEART', count: 0, viewerHasReacted: false }],
} as TComment
const key = commentKeys.list('home', THREAD.POST, '42')
const otherArticleKey = commentKeys.list('home', THREAD.POST, '99')
const scope = { community: 'home', thread: THREAD.POST, articleInnerId: '42' }

describe('comment query mutation helpers', () => {
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
      totalCount: 2,
      entries: [{ innerId: 'pending:1' }, { innerId: '1' }],
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
    const viewerKey = viewerKeys.commentStates('alice', 'home:POST:42', ['1'])
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

  it('replaces a pending comment and invalidates the ArticleStats entity', () => {
    const queryClient = new QueryClient()
    const articleStatsKey = articleKeys.articleStats('home', THREAD.POST, '42')
    queryClient.setQueryData(articleStatsKey, { commentsCount: 8 })
    queryClient.setQueryData(key, {
      entries: [{ ...root, innerId: 'pending:1' }],
      totalCount: 1,
    })

    reconcileCreatedComment(
      queryClient,
      scope,
      'pending:1',
      { ...root, innerId: 'confirmed-1' },
      { community: 'home', thread: THREAD.POST, innerId: '42' },
    )

    expect(queryClient.getQueryState(articleStatsKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryData<{ entries: TComment[] }>(key)?.entries[0].innerId).toBe(
      'confirmed-1',
    )
  })

  it('routes article aggregate patches only to article entity queries', () => {
    const queryClient = new QueryClient()
    const detailKey = articleKeys.detail('home', THREAD.POST, '42')
    const tagGroupsKey = articleKeys.tagGroups('home', THREAD.POST)
    queryClient.setQueryData(detailKey, { innerId: '42' })
    queryClient.setQueryData(tagGroupsKey, { innerId: '42' })

    expect(articleQueryTargets(queryClient).map(({ queryKey }) => queryKey)).toEqual([detailKey])
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
    const context = { queryClient, accountRef: 'alice', commandId: 'op-1' }
    const plan = deleteCommentOperation.apply(context, target)

    for (const change of plan.changes) markChange(queryClient, change)
    expect(queryClient.getQueryData<{ entries: TComment[] }>(key)?.entries).toEqual([])

    rollbackChanges(queryClient, plan.changes)
    expect(queryClient.getQueryData<{ entries: TComment[] }>(key)?.entries[0].innerId).toBe('1')
  })

  it('reconciles the Article comment revision returned by an update', () => {
    const queryClient = new QueryClient()
    const articleStatsKey = articleKeys.articleStats('home', THREAD.POST, '42')
    queryClient.setQueryData(articleStatsKey, { commentsCount: 8 })
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
      { queryClient, accountRef: 'alice', commandId: 'op-update' },
      target,
      'updated body',
      {
        ...root,
        bodyHtml: 'updated body',
        article: { innerId: '42', commentsCount: 8, commentsRevision: 3 },
      },
    )

    expect(queryClient.getQueryState(articleStatsKey)?.isInvalidated).toBe(true)
  })

  it('invalidates ArticleStats after delete', () => {
    const queryClient = new QueryClient()
    const articleStatsKey = articleKeys.articleStats('home', THREAD.POST, '42')
    queryClient.setQueryData(articleStatsKey, { commentsCount: 7 })
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
      { queryClient, accountRef: 'alice', commandId: 'op-delete' },
      target,
      undefined,
      {
        ...root,
        article: { innerId: '42', commentsCount: 9, commentsRevision: 3 },
      },
    )

    expect(queryClient.getQueryState(articleStatsKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryData<{ entries: TComment[] }>(key)?.entries).toEqual([])
  })
})
