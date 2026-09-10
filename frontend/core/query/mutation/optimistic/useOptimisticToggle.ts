'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

import { enqueueOptimisticToggle } from './toggle'
import type { TOptimisticToggleOperation, TReadOperationContext } from './types'

/** Adapter for idempotent set-state operations with last-intent coalescing. */
export default function useOptimisticToggle<TTarget, TResult>(
  operation: TOptimisticToggleOperation<TTarget, TResult>,
  target: TTarget | null,
) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const accountRef = account.accountRef || getAccountRef(account.user)
  const [pendingState, setPendingState] = useState<boolean | null>(null)
  const [, forceRender] = useState(0)
  const targetKey = target ? operation.entityKey(target) : null
  const context = useMemo<TReadOperationContext>(
    () => ({ queryClient, accountRef }),
    [accountRef, queryClient],
  )

  const currentState = target ? operation.read(context, target) : null
  const visibleState = pendingState ?? currentState
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
      if (!target || !targetKey || !accountRef) return
      const nextState = next ?? !visibleState
      setPendingState(nextState)
      void enqueueOptimisticToggle({ queryClient, accountRef, operation, target, next })
        .catch(() => undefined)
        .finally(() => {
          setPendingState(null)
          forceRender((value) => value + 1)
        })
    },
    [accountRef, operation, queryClient, target, targetKey, visibleState],
  )

  return {
    currentState,
    visibleState,
    toggle,
  }
}
