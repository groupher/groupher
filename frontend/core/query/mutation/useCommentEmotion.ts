'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import type { TComment, TEmotionType } from '~/spec'
import useAccount from '~/stores/account/hooks'

import { commentEmotionOperation, type TCommentEmotionTarget } from './comment'
import { enqueueOptimisticToggle } from './optimistic/toggle'
import useOptimisticToggleFeedback from './optimistic/useOptimisticToggleFeedback'
import useCommentProjection from './useCommentProjection'
import useCommentTarget from './useCommentTarget'

/** Binds the shared optimistic toggle to Comment emotion selection. */
export default function useCommentEmotion(comment: TComment) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const accountScope = account.accountScope || ''
  const target = useCommentTarget(comment)
  const visibleComment = useCommentProjection(comment, target.scope)
  const scopeKey = `${accountScope}:${target.articleKey}:${target.commentInnerId}`
  const { clear: clearError, error, reportFailure, track } = useOptimisticToggleFeedback(scopeKey)

  const toggle = useCallback(
    (name: TEmotionType): void => {
      if (!accountScope) return
      clearError()
      const emotionTarget: TCommentEmotionTarget = { ...target, emotionName: name }
      const handle = enqueueOptimisticToggle({
        queryClient,
        accountScope,
        operation: commentEmotionOperation,
        target: emotionTarget,
      })
      const attempt = track(handle)
      void handle.promise.catch((requestError: unknown) => {
        reportFailure(attempt, requestError, 'Comment emotion request failed')
      })
    },
    [accountScope, clearError, queryClient, reportFailure, target, track],
  )

  return {
    emotions: visibleComment.emotions || [],
    error,
    toggle,
  }
}
