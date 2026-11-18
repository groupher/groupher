'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import { toast } from '~/ui/Toaster'

type TToggleHandle = { created: boolean }
type TToggleError = { error: unknown; scope: string }
export type TOptimisticToggleAttempt = {
  created: boolean
  execution: number
  intentKey: string
  scope: string
  scopeVersion: number
}

/** Shares scoped failure feedback while keeping one toast owner per coalesced intent. */
export default function useOptimisticToggleFeedback(scope: string) {
  const { t } = useTrans()
  const [errorState, setErrorState] = useState<TToggleError | null>(null)
  const mountedRef = useRef(true)
  const executionByIntentRef = useRef(new Map<string, number>())
  const scopeVersionRef = useRef(0)
  const scopeRef = useRef(scope)
  const renderedScopeRef = useRef(scope)
  const error = errorState?.scope === scope ? errorState.error : null

  useLayoutEffect(() => {
    renderedScopeRef.current = scope
    if (scopeRef.current === scope) return
    scopeRef.current = scope
    scopeVersionRef.current += 1
    executionByIntentRef.current.clear()
    setErrorState(null)
  }, [scope])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      scopeVersionRef.current += 1
      executionByIntentRef.current.clear()
    }
  }, [])

  const clear = useCallback(() => setErrorState(null), [])
  const track = useCallback(
    (handle: TToggleHandle, intentKey: string): TOptimisticToggleAttempt => {
      const currentExecution = executionByIntentRef.current.get(intentKey) ?? 0
      const execution = handle.created ? currentExecution + 1 : Math.max(currentExecution, 1)
      executionByIntentRef.current.set(intentKey, execution)
      return {
        created: handle.created,
        execution,
        intentKey,
        scope,
        scopeVersion: scopeVersionRef.current,
      }
    },
    [scope],
  )
  const isCurrent = useCallback(
    (attempt: TOptimisticToggleAttempt): boolean =>
      mountedRef.current &&
      renderedScopeRef.current === attempt.scope &&
      scopeVersionRef.current === attempt.scopeVersion &&
      executionByIntentRef.current.get(attempt.intentKey) === attempt.execution,
    [],
  )
  const reportFailure = useCallback(
    (attempt: TOptimisticToggleAttempt, requestError: unknown, fallbackMessage: string): void => {
      if (!isCurrent(attempt)) return
      setErrorState({
        scope: attempt.scope,
        error: requestError ?? new Error(fallbackMessage),
      })
      if (attempt.created) toast(t('operation.failed_retry'), 'error')
    },
    [isCurrent, t],
  )

  return { clear, error, isCurrent, reportFailure, track }
}
