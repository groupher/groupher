'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import useAccount from '~/stores/account/hooks'
import { toast } from '~/ui/Toaster'

import { enqueueOptimisticToggle } from './toggle'
import type { TOptimisticToggleOperation, TReadOperationContext } from './types'

/** Adapter for idempotent set-state operations with last-intent coalescing. */
export default function useOptimisticToggle<TTarget, TResult>(
  operation: TOptimisticToggleOperation<TTarget, TResult>,
  target: TTarget | null,
) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const { t } = useTrans()
  const accountScope = account.accountScope
  const [pendingState, setPendingState] = useState<boolean | null>(null)
  const [error, setError] = useState<unknown | null>(null)
  const [, forceRender] = useState(0)
  const executionRef = useRef(0)
  const mountedRef = useRef(true)
  const targetKey = target ? operation.entityKey(target) : null
  const currentToggleScope = `${accountScope || ''}:${targetKey || ''}`
  const renderedScopeRef = useRef(currentToggleScope)
  const pendingScopeRef = useRef(currentToggleScope)
  const context = useMemo<TReadOperationContext>(
    () => ({ queryClient, accountScope }),
    [accountScope, queryClient],
  )

  const currentState = target ? operation.read(context, target) : null
  const visibleState = pendingState ?? currentState
  const selectedStateRef = useRef<boolean | null>(currentState)

  useEffect(() => {
    selectedStateRef.current = currentState
  }, [currentState])

  useLayoutEffect(() => {
    renderedScopeRef.current = currentToggleScope
  }, [currentToggleScope])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      executionRef.current += 1
    }
  }, [])

  useEffect(() => {
    if (pendingScopeRef.current === currentToggleScope) return
    pendingScopeRef.current = currentToggleScope
    executionRef.current += 1
    setPendingState(null)
    setError(null)
  }, [currentToggleScope])

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
      setPendingState(nextState)
      setError(null)
      const scopeAtStart = `${accountScope}:${targetKey}`
      const handle = enqueueOptimisticToggle({ queryClient, accountScope, operation, target, next })
      if (handle.created) executionRef.current += 1
      const executionAtStart = executionRef.current
      void handle.promise
        .catch((requestError: unknown) => {
          if (
            mountedRef.current &&
            renderedScopeRef.current === scopeAtStart &&
            executionRef.current === executionAtStart
          ) {
            if (handle.created) toast(t('operation.failed_retry'), 'error')
            else setError(requestError ?? new Error('Optimistic toggle failed'))
          }
        })
        .finally(() => {
          if (
            mountedRef.current &&
            renderedScopeRef.current === scopeAtStart &&
            executionRef.current === executionAtStart
          ) {
            setPendingState(null)
            forceRender((value) => value + 1)
          }
        })
    },
    [accountScope, operation, queryClient, t, target, targetKey, visibleState],
  )

  return {
    currentState,
    visibleState,
    error,
    toggle,
  }
}
