'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TComment, TEmotionType } from '~/spec'
import useAccount from '~/stores/account/hooks'
import { toast } from '~/ui/Toaster'

import { commentEmotionOperation, type TCommentEmotionTarget } from './comment'
import { enqueueOptimisticToggle } from './optimistic/toggle'
import useCommentProjection from './useCommentProjection'
import useCommentTarget from './useCommentTarget'

/** Binds the shared optimistic toggle to Comment emotion selection. */
export default function useCommentEmotion(comment: TComment) {
  const queryClient = useQueryClient()
  const { t } = useTrans()
  const account = useAccount()
  const accountScope = account.accountScope || ''
  const target = useCommentTarget(comment)
  const visibleComment = useCommentProjection(comment, target.scope)
  const scopeKey = `${accountScope}:${target.articleKey}:${target.commentInnerId}`
  const [error, setError] = useState<unknown | null>(null)
  const mountedRef = useRef(true)
  const errorScopeRef = useRef(scopeKey)
  const renderedScopeRef = useRef(scopeKey)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useLayoutEffect(() => {
    renderedScopeRef.current = scopeKey
  }, [scopeKey])

  useEffect(() => {
    if (errorScopeRef.current === scopeKey) return
    errorScopeRef.current = scopeKey
    setError(null)
  }, [scopeKey])

  const toggle = useCallback(
    (name: TEmotionType): void => {
      if (!accountScope) return
      setError(null)
      const emotionTarget: TCommentEmotionTarget = { ...target, emotionName: name }
      const handle = enqueueOptimisticToggle({
        queryClient,
        accountScope,
        operation: commentEmotionOperation,
        target: emotionTarget,
      })
      void handle.promise.catch((requestError: unknown) => {
        if (!mountedRef.current || renderedScopeRef.current !== scopeKey) return
        if (handle.created) toast(t('operation.failed_retry'), 'error')
        else setError(requestError ?? new Error('Comment emotion request failed'))
      })
    },
    [accountScope, queryClient, scopeKey, t, target],
  )

  return {
    emotions: visibleComment.emotions || [],
    error,
    toggle,
  }
}
