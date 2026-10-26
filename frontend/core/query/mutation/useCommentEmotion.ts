'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import type { TComment, TEmotionType } from '~/spec'
import useAccount from '~/stores/account/hooks'

import { commentEmotionOperation, type TCommentEmotionTarget } from './comment'
import { enqueueOptimisticToggle } from './optimistic/toggle'
import useCommentProjection from './useCommentProjection'
import useCommentTarget from './useCommentTarget'

/** Binds the shared optimistic toggle to Comment emotion selection. */
export default function useCommentEmotion(comment: TComment) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const accountScope = account.accountScope || ''
  const target = useCommentTarget(comment)
  const visibleComment = useCommentProjection(comment, target.scope)

  const toggle = useCallback(
    (name: TEmotionType): void => {
      if (!accountScope) return
      const emotionTarget: TCommentEmotionTarget = { ...target, emotionName: name }
      void enqueueOptimisticToggle({
        queryClient,
        accountScope,
        operation: commentEmotionOperation,
        target: emotionTarget,
      }).catch(() => undefined)
    },
    [accountScope, queryClient, target],
  )

  return {
    emotions: visibleComment.emotions || [],
    toggle,
  }
}
