'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { THREAD } from '~/const/thread'
import { CONFIRMED_COMMENT_RECEIPT_MAX_REFS } from '~/constant/cache'
import { stripCommentViewerState, type TCommentViewerStates } from '~/lib/commentViewerState'
import type { TArticle, TComment } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

import { Q } from './client'
import { viewerQueryKeys } from './key'
import { patchCommentEverywhere, type TCommentScope } from './mutation/comment'
import {
  clearCommentReactionReceipt,
  readCommentReactionReceipts,
} from './mutation/commentReactionReceipt'
import { clearCommentFeedReceipt, readCommentFeedReceipts } from './mutation/commentReceipt'

const publicComment = (comment: TComment): TComment => stripCommentViewerState(comment)

const mergeViewerState = (
  queryClient: ReturnType<typeof useQueryClient>,
  accountRef: string,
  articleKey: string,
  comment: TComment,
): void => {
  queryClient.setQueriesData<TCommentViewerStates>(
    { queryKey: viewerQueryKeys.commentStatePrefix(accountRef, articleKey) },
    (states) => {
      if (!states) return states
      const emotionFlags = Object.fromEntries(
        (comment.emotions || []).map((emotion) => [
          String(emotion.type).toUpperCase(),
          Boolean(emotion.viewerHasReacted),
        ]),
      )
      return {
        ...states,
        [String(comment.innerId)]: {
          ...(states[String(comment.innerId)] || { emotionFlags: {} }),
          viewerHasUpvoted: comment.viewerHasUpvoted,
          viewerHasReported: comment.viewerHasReported,
          emotionFlags,
        },
      }
    },
  )
}

/** Reconciles confirmed Comment receipts through one bounded private batch read. */
export default function useCommentReceiptReconcile(article: TArticle | null | undefined) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const accountRef = account.accountRef || getAccountRef(account.user)

  const scope = useMemo<TCommentScope | null>(() => {
    if (!article) return null
    return {
      community: article.community.slug,
      thread: article.meta.thread,
      articleInnerId: String(article.innerId),
    }
  }, [article])
  const articleKey = scope
    ? `${scope.community}:${scope.thread}:${String(scope.articleInnerId)}`
    : ''
  const receipts = useMemo(() => {
    if (!accountRef || !scope)
      return { feedByRef: new Map(), reactionByRef: new Map(), refs: [] as string[] }
    const feedByRef = new Map(
      readCommentFeedReceipts(accountRef, articleKey).map((receipt) => [
        receipt.commentRef,
        receipt,
      ]),
    )
    const reactionByRef = new Map(
      readCommentReactionReceipts(accountRef, articleKey).map((receipt) => [
        receipt.commentRef,
        receipt,
      ]),
    )
    const confirmedAtByRef = new Map<string, number>()
    for (const receipt of feedByRef.values())
      confirmedAtByRef.set(
        receipt.commentRef,
        Math.max(confirmedAtByRef.get(receipt.commentRef) || 0, receipt.confirmedAt),
      )
    for (const receipt of reactionByRef.values())
      confirmedAtByRef.set(
        receipt.commentRef,
        Math.max(confirmedAtByRef.get(receipt.commentRef) || 0, receipt.confirmedAt),
      )
    const refs = [...confirmedAtByRef]
      .sort(
        ([leftRef, leftAt], [rightRef, rightAt]) =>
          rightAt - leftAt || leftRef.localeCompare(rightRef),
      )
      .slice(0, CONFIRMED_COMMENT_RECEIPT_MAX_REFS)
      .map(([commentRef]) => commentRef)
      .sort()
    return { feedByRef, reactionByRef, refs }
  }, [accountRef, articleKey, scope])

  const query = useQuery(
    Q.comment.reconcile(
      scope?.community || '',
      scope?.thread || THREAD.POST,
      scope?.articleInnerId || '',
      receipts.refs,
    ),
  )

  useEffect(() => {
    if (!accountRef || !scope || !query.data) return
    const confirmedArticle = query.data.article
    for (const [commentRef, rawComment] of Object.entries(query.data.comments)) {
      const reactionReceipt = receipts.reactionByRef.get(commentRef)
      const feedReceipt = receipts.feedByRef.get(commentRef)
      const feedRevision = feedReceipt?.publicProjection.commentsRevision

      if (!rawComment) {
        if (reactionReceipt) clearCommentReactionReceipt(accountRef, articleKey, commentRef)
        if (
          feedReceipt?.type === 'delete' &&
          (typeof feedRevision !== 'number' || confirmedArticle.commentsRevision >= feedRevision)
        ) {
          clearCommentFeedReceipt(accountRef, articleKey, commentRef)
        }
        continue
      }

      const comment = rawComment as TComment
      const publicRevision = comment.commentInteractionRevision
      const reactionRevision = reactionReceipt?.publicProjection.commentInteractionRevision

      if (
        reactionReceipt &&
        (typeof reactionRevision !== 'number' ||
          typeof publicRevision !== 'number' ||
          publicRevision >= reactionRevision)
      ) {
        clearCommentReactionReceipt(accountRef, articleKey, commentRef)
      }

      if (feedReceipt?.type === 'delete') {
        // A private read that still returns a live Comment means the feed has
        // not converged yet; leave the tombstone active.
        const lifecycle = (comment as TComment & { lifecycle?: { state?: string } }).lifecycle
        if (lifecycle?.state === 'DELETED' || comment.bodyHtml === undefined) {
          clearCommentFeedReceipt(accountRef, articleKey, commentRef)
        }
        continue
      }

      if (reactionReceipt && typeof reactionRevision === 'number') {
        if (typeof publicRevision === 'number' && publicRevision < reactionRevision) {
          mergeViewerState(queryClient, accountRef, articleKey, comment)
          continue
        }
      }

      const publicValue = publicComment(comment)
      patchCommentEverywhere(queryClient, scope, commentRef, () => publicValue)
      mergeViewerState(queryClient, accountRef, articleKey, comment)
      if (
        feedReceipt &&
        (typeof feedRevision !== 'number' || confirmedArticle.commentsRevision >= feedRevision)
      ) {
        clearCommentFeedReceipt(accountRef, articleKey, commentRef)
      }
    }
  }, [accountRef, articleKey, query.data, queryClient, receipts, scope])

  return query
}
