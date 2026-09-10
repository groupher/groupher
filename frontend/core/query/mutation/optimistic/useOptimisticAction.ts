'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'

import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

import { executeOptimisticOperation } from './execute'
import type { TOptimisticOperation } from './types'

/** Adapter for non-toggle operations. Domain callbacks remain responsible for typed cache patches. */
export default function useOptimisticAction<TTarget, TInput, TResult>(
  operation: TOptimisticOperation<TTarget, TInput, TResult>,
  target: TTarget | null,
) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const accountRef = account.accountRef || getAccountRef(account.user)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const pendingCount = useRef(0)

  const submit = useCallback(
    async (input: TInput): Promise<TResult> => {
      if (!target || !accountRef)
        return Promise.reject(new Error('Operation target is unavailable'))
      pendingCount.current += 1
      setIsSubmitting(true)
      setError(null)
      try {
        return await executeOptimisticOperation({
          queryClient,
          accountRef,
          operation,
          target,
          input,
        })
      } catch (error) {
        setError(error instanceof Error ? error : new Error(String(error)))
        throw error
      } finally {
        pendingCount.current = Math.max(0, pendingCount.current - 1)
        setIsSubmitting(pendingCount.current > 0)
      }
    },
    [accountRef, operation, queryClient, target],
  )

  return { submit, isSubmitting, error }
}
