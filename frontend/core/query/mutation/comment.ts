import type { QueryClient } from '@tanstack/react-query'

import type { TCommentViewerStates } from '~/lib/commentViewerState'
import type { TComment, TThread } from '~/spec'

import { commentKeys, viewerKeys } from '../key'
import { patchArticleEverywhere } from './article'

const patchEntries = (
  entries: TComment[],
  innerId: string,
  updater: (comment: TComment) => TComment | null,
): TComment[] => {
  const next: TComment[] = []
  for (const entry of entries) {
    if (String(entry.innerId) === innerId) {
      const patched = updater(entry)
      if (patched) next.push(patched)
      continue
    }
    if (!entry.replies?.length) {
      next.push(entry)
      continue
    }
    next.push({ ...entry, replies: patchEntries(entry.replies, innerId, updater) })
  }
  return next
}

/** Applies one comment update across timeline and nested-reply query shapes. */
export const patchCommentEverywhere = (
  queryClient: QueryClient,
  innerId: string | number,
  updater: (comment: TComment) => TComment | null,
): void => {
  queryClient.setQueriesData(
    { queryKey: commentKeys.all },
    (data: { entries?: TComment[] } | undefined) =>
      data?.entries
        ? {
            ...data,
            entries: patchEntries(data.entries, String(innerId), updater),
          }
        : data,
  )
}

/** Inserts a temporary top-level comment into loaded first-page comment queries. */
export const insertPendingComment = (queryClient: QueryClient, comment: TComment): void => {
  queryClient.setQueriesData(
    { queryKey: commentKeys.all },
    (data: { entries?: TComment[]; totalCount?: number; pageNumber?: number } | undefined) =>
      data?.entries && (data.pageNumber || 1) === 1
        ? {
            ...data,
            entries: [comment, ...data.entries],
            totalCount: (data.totalCount || 0) + 1,
          }
        : data,
  )
}

/** Inserts a temporary reply below its parent in every loaded comment shape. */
export const insertPendingReply = (
  queryClient: QueryClient,
  parentId: string | number,
  reply: TComment,
): void => {
  patchCommentEverywhere(queryClient, parentId, (parent) => ({
    ...parent,
    replies: [...(parent.replies || []), reply],
  }))
}

/** Replaces a pending comment and converges the article count to the mutation payload. */
export const reconcileCreatedComment = (
  queryClient: QueryClient,
  pendingInnerId: string | number,
  confirmed: TComment,
  article: { community: string; thread: TThread; innerId: string },
  commentsCount: number,
): void => {
  patchCommentEverywhere(queryClient, pendingInnerId, () => confirmed)
  patchArticleEverywhere(queryClient, article, (current) => ({
    ...current,
    commentsCount,
  }))
}

/** Updates viewer-owned comment flags without replacing public aggregates. */
export const patchCommentViewerState = (
  queryClient: QueryClient,
  viewerScope: string,
  articleKey: string,
  innerId: string | number,
  updater: (state: TCommentViewerStates[string]) => TCommentViewerStates[string],
): void => {
  queryClient.setQueriesData<TCommentViewerStates>(
    { queryKey: [...viewerKeys.all, viewerScope, 'comment-state', articleKey] },
    (states) => {
      if (!states) return states
      const key = String(innerId)
      return {
        ...states,
        [key]: updater(states[key] || { emotionFlags: {} }),
      }
    },
  )
}

/** Updates a public emotion count while stripping viewer-owned reaction flags. */
export const updateCommentEmotion = (
  comment: TComment,
  type: string,
  nextViewerState: boolean,
): TComment => {
  const emotionType = type.toUpperCase()
  const emotions = comment.emotions || []
  const exists = emotions.some((emotion) => emotion.type === emotionType)
  const nextEmotions = emotions.map((emotion) => {
    const { viewerHasReacted: _viewerHasReacted, ...publicEmotion } = emotion
    return emotion.type === emotionType
      ? {
          ...publicEmotion,
          count: Math.max(0, (emotion.count || 0) + (nextViewerState ? 1 : -1)),
        }
      : publicEmotion
  })

  return {
    ...comment,
    emotions: exists
      ? nextEmotions
      : [
          ...nextEmotions,
          {
            type: emotionType,
            count: nextViewerState ? 1 : 0,
            latestUsers: [],
          },
        ],
  } as TComment
}
