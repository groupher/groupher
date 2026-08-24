'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { browserQuery } from '~/graphql/client'
import useViewingArticle from '~/hooks/useViewingArticle'
import type { TComment, TEmotionRawType, TEmotionType } from '~/spec'
import useAccount from '~/stores/account/hooks'
import commentsSchema from '~/unit/Comments/schema'

import { commentKeys, mutationKeys, viewerKeys } from '../key'
import { patchCommentEverywhere, patchCommentViewerState, updateCommentEmotion } from './comment'

type TMutationSnapshot = {
  comments: ReturnType<ReturnType<typeof useQueryClient>['getQueriesData']>
  viewer: ReturnType<ReturnType<typeof useQueryClient>['getQueriesData']>
}

const publicEmotions = (comment: TComment): TComment['emotions'] =>
  (comment.emotions || []).map((emotion) => {
    const { viewerHasReacted: _viewerHasReacted, ...publicEmotion } = emotion
    return publicEmotion
  }) as TComment['emotions']

/** Owns comment reaction transport, optimistic cache updates, rollback, and reconcile. */
export default function useCommentReactions(comment: TComment) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const { article } = useViewingArticle()
  const viewerScope = account.user?.login || ''
  const articlePath = {
    community: article.community.slug,
    thread: article.meta.thread,
    innerId: String(article.innerId),
  }
  const articleKey = `${articlePath.community}:${articlePath.thread}:${articlePath.innerId}`
  const commentPath = { article: articlePath, innerId: String(comment.innerId) }
  const commentKey = `${articleKey}:${comment.innerId}`
  const viewerPrefix = [...viewerKeys.all, viewerScope, 'comment-state', articleKey] as const
  const upvoteDesiredRef = useRef(Boolean(comment.viewerHasUpvoted))
  const upvoteRunningRef = useRef(false)
  const emotionDesiredRef = useRef(new Map<TEmotionType, boolean>())
  const emotionRunningRef = useRef(false)

  const snapshot = async (): Promise<TMutationSnapshot> => {
    await Promise.all([
      queryClient.cancelQueries({ queryKey: commentKeys.all }),
      queryClient.cancelQueries({ queryKey: viewerPrefix }),
    ])
    return {
      comments: queryClient.getQueriesData({ queryKey: commentKeys.all }),
      viewer: queryClient.getQueriesData({ queryKey: viewerPrefix }),
    }
  }

  const restore = (state: TMutationSnapshot | undefined): void => {
    if (!state) return
    for (const [key, data] of state.comments) queryClient.setQueryData(key, data)
    for (const [key, data] of state.viewer) queryClient.setQueryData(key, data)
  }

  const upvote = useMutation({
    mutationKey: mutationKeys.comment(commentKey, 'upvote'),
    scope: { id: `comment:${commentKey}` },
    retry: false,
    mutationFn: async (nextViewerState: boolean): Promise<TComment> => {
      const result = nextViewerState
        ? (
            await browserQuery(commentsSchema.upvoteComment, {
              comment: commentPath,
            })
          ).upvoteComment
        : (
            await browserQuery(commentsSchema.undoUpvoteComment, {
              comment: commentPath,
            })
          ).undoUpvoteComment
      if (!result) throw new Error('Comment upvote response is empty')
      return result as unknown as TComment
    },
    onMutate: async (nextViewerState) => {
      const state = await snapshot()
      patchCommentEverywhere(queryClient, comment.innerId, (current) => ({
        ...current,
        upvotesCount: Math.max(0, current.upvotesCount + (nextViewerState ? 1 : -1)),
      }))
      if (viewerScope) {
        patchCommentViewerState(
          queryClient,
          viewerScope,
          articleKey,
          comment.innerId,
          (current) => ({ ...current, viewerHasUpvoted: nextViewerState }),
        )
      }
      return state
    },
    onError: (_error, _variables, state) => restore(state),
    onSuccess: (confirmed, nextViewerState) => {
      patchCommentEverywhere(queryClient, comment.innerId, (current) => ({
        ...current,
        meta: confirmed.meta,
        upvotesCount: confirmed.upvotesCount,
      }))
      if (viewerScope) {
        patchCommentViewerState(
          queryClient,
          viewerScope,
          articleKey,
          comment.innerId,
          (current) => ({
            ...current,
            viewerHasUpvoted:
              typeof confirmed.viewerHasUpvoted === 'boolean'
                ? confirmed.viewerHasUpvoted
                : nextViewerState,
          }),
        )
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: commentKeys.all, refetchType: 'none' }),
  })

  const emotion = useMutation({
    mutationKey: mutationKeys.comment(commentKey, 'emotion'),
    scope: { id: `comment:${commentKey}` },
    retry: false,
    mutationFn: async ({
      name,
      nextViewerState,
    }: {
      name: TEmotionType
      nextViewerState: boolean
    }): Promise<TComment> => {
      const emotionType = name.toUpperCase() as Exclude<TEmotionRawType, 'UPVOTE'>
      const result = nextViewerState
        ? (
            await browserQuery(commentsSchema.emotionToComment, {
              comment: commentPath,
              emotion: emotionType,
            })
          ).emotionToComment
        : (
            await browserQuery(commentsSchema.undoEmotionToComment, {
              comment: commentPath,
              emotion: emotionType,
            })
          ).undoEmotionToComment
      if (!result) throw new Error('Comment emotion response is empty')
      return result as unknown as TComment
    },
    onMutate: async ({ name, nextViewerState }) => {
      const state = await snapshot()
      patchCommentEverywhere(queryClient, comment.innerId, (current) =>
        updateCommentEmotion(current, name, nextViewerState),
      )
      if (viewerScope) {
        patchCommentViewerState(
          queryClient,
          viewerScope,
          articleKey,
          comment.innerId,
          (current) => ({
            ...current,
            emotionFlags: {
              ...current.emotionFlags,
              [name.toUpperCase()]: nextViewerState,
            },
          }),
        )
      }
      return state
    },
    onError: (_error, _variables, state) => restore(state),
    onSuccess: (confirmed, { name, nextViewerState }) => {
      patchCommentEverywhere(queryClient, comment.innerId, (current) => ({
        ...current,
        emotions: publicEmotions(confirmed),
      }))
      const confirmedEmotion = (confirmed.emotions || []).find(
        (item) => item.type === name.toUpperCase(),
      )
      if (viewerScope) {
        patchCommentViewerState(
          queryClient,
          viewerScope,
          articleKey,
          comment.innerId,
          (current) => ({
            ...current,
            emotionFlags: {
              ...current.emotionFlags,
              [name.toUpperCase()]:
                typeof confirmedEmotion?.viewerHasReacted === 'boolean'
                  ? confirmedEmotion.viewerHasReacted
                  : nextViewerState,
            },
          }),
        )
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: commentKeys.all, refetchType: 'none' }),
  })

  useEffect(() => {
    if (!upvoteRunningRef.current) {
      upvoteDesiredRef.current = Boolean(comment.viewerHasUpvoted)
    }
  }, [comment.viewerHasUpvoted])

  const flushUpvoteIntent = (): void => {
    if (upvoteRunningRef.current) return
    const target = upvoteDesiredRef.current
    upvoteRunningRef.current = true
    upvote.mutate(target, {
      onSettled: () => {
        upvoteRunningRef.current = false
        if (upvoteDesiredRef.current !== target) queueMicrotask(flushUpvoteIntent)
      },
    })
  }

  const flushEmotionIntent = (): void => {
    if (emotionRunningRef.current) return
    const next = emotionDesiredRef.current.entries().next().value
    if (!next) return
    const [name, target] = next
    emotionRunningRef.current = true
    emotion.mutate(
      { name, nextViewerState: target },
      {
        onSettled: () => {
          if (emotionDesiredRef.current.get(name) === target) {
            emotionDesiredRef.current.delete(name)
          }
          emotionRunningRef.current = false
          queueMicrotask(flushEmotionIntent)
        },
      },
    )
  }

  return {
    handleEmotion: (name: TEmotionType, viewerHasReacted: boolean): void => {
      const current = emotionDesiredRef.current.has(name)
        ? Boolean(emotionDesiredRef.current.get(name))
        : viewerHasReacted
      emotionDesiredRef.current.set(name, !current)
      flushEmotionIntent()
    },
    handleUpvote: (_nextViewerState: boolean): void => {
      upvoteDesiredRef.current = !upvoteDesiredRef.current
      flushUpvoteIntent()
    },
    isEmotionPending: emotion.isPending,
    isUpvotePending: upvote.isPending,
  }
}
