'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import useAccount from '~/stores/account/hooks'

import { enqueueOptimisticToggle } from './toggle'
import type { TOptimisticToggleOperation, TReadOperationContext } from './types'
import useOptimisticToggleFeedback, {
  type TOptimisticToggleAttempt,
} from './useOptimisticToggleFeedback'

/** Adapter for idempotent set-state operations with last-intent coalescing. */
export default function useOptimisticToggle<TTarget, TResult>(
  operation: TOptimisticToggleOperation<TTarget, TResult>,
  target: TTarget | null,
) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const accountScope = account.accountScope
  const [pendingState, setPendingState] = useState<{
    attempt: TOptimisticToggleAttempt
    scope: string
    state: boolean
  } | null>(null)
  const [, forceRender] = useState(0)
  const targetKey = target ? operation.entityKey(target) : null
  const currentToggleScope = `${accountScope || ''}:${targetKey || ''}`
  const {
    clear: clearError,
    error,
    isCurrent,
    reportFailure,
    track,
  } = useOptimisticToggleFeedback(currentToggleScope)
  const context = useMemo<TReadOperationContext>(
    () => ({ queryClient, accountScope }),
    [accountScope, queryClient],
  )

  const currentState = target ? operation.read(context, target) : null
  const visibleState =
    pendingState?.scope === currentToggleScope && isCurrent(pendingState.attempt)
      ? pendingState.state
      : currentState
  const selectedStateRef = useRef<boolean | null>(currentState)

  useEffect(() => {
    selectedStateRef.current = currentState
  }, [currentState])

  // QueryClient is the canonical owner. Cache events are global, so compare the
  // operation's entity selector before scheduling a render; unrelated query
  // updates must not re-render every toggle on a list page.
  useEffect(() => {
    return queryClient.getQueryCache().subscribe(() => {
      const nextState = target ? operation.read(context, target) : null
      if (Object.is(selectedStateRef.current, nextState)) return
      selectedStateRef.current = nextState
      forceRender((value) => value + 1)
    })
  }, [context, operation, queryClient, target, targetKey])

  const toggle = useCallback(
    (next?: boolean): void => {
      if (!target || !targetKey || !accountScope) return
      const nextState = next ?? !visibleState
      const scopeAtStart = `${accountScope}:${targetKey}`
      clearError()
      const handle = enqueueOptimisticToggle({ queryClient, accountScope, operation, target, next })
      const attempt = track(handle, targetKey)
      setPendingState({ attempt, scope: scopeAtStart, state: nextState })
      void handle.promise
        .catch((requestError: unknown) => {
          reportFailure(attempt, requestError, 'Optimistic toggle failed')
        })
        .finally(() => {
          if (isCurrent(attempt)) {
            setPendingState(null)
            forceRender((value) => value + 1)
          }
        })
    },
    [
      accountScope,
      clearError,
      isCurrent,
      operation,
      queryClient,
      reportFailure,
      target,
      targetKey,
      track,
      visibleState,
    ],
  )

  return {
    currentState,
    visibleState,
    error,
    toggle,
  }
}
