'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import type { TComment, TEmotionType } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

import { commentEmotionOperation, type TCommentEmotionTarget } from './comment'
import { enqueueOptimisticToggle } from './optimistic/toggle'
import useCommentProjection from './useCommentProjection'
import useCommentTarget from './useCommentTarget'

/** Binds the shared optimistic toggle to Comment emotion selection. */
export default function useCommentEmotion(comment: TComment) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const accountRef = account.accountRef || getAccountRef(account.user) || ''
  const target = useCommentTarget(comment)
  const visibleComment = useCommentProjection(comment, target.scope)

  const toggle = useCallback(
    (name: TEmotionType): void => {
      if (!accountRef) return
      const emotionTarget: TCommentEmotionTarget = { ...target, emotionName: name }
      void enqueueOptimisticToggle({
        queryClient,
        accountRef,
        operation: commentEmotionOperation,
        target: emotionTarget,
      }).catch(() => undefined)
    },
    [accountRef, queryClient, target],
  )

  return {
    emotions: visibleComment.emotions || [],
    toggle,
  }
}
