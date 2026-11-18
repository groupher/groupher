'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import { toast } from '~/ui/Toaster'

type TToggleHandle = { created: boolean }
type TToggleAttempt = { created: boolean; execution: number; scope: string }

/** Shares scoped failure feedback while keeping one toast owner per coalesced intent. */
export default function useOptimisticToggleFeedback(scope: string) {
  const { t } = useTrans()
  const [errorState, setErrorState] = useState<{ scope: string; error: unknown } | null>(null)
  const mountedRef = useRef(true)
  const executionRef = useRef(0)
  const scopeRef = useRef(scope)
  const renderedScopeRef = useRef(scope)
  const error = errorState?.scope === scope ? errorState.error : null

  useLayoutEffect(() => {
    renderedScopeRef.current = scope
  }, [scope])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      executionRef.current += 1
    }
  }, [])

  useEffect(() => {
    if (scopeRef.current === scope) return
    scopeRef.current = scope
    executionRef.current += 1
    setErrorState(null)
  }, [scope])

  const clear = useCallback(() => setErrorState(null), [])
  const track = useCallback(
    (handle: TToggleHandle): TToggleAttempt => {
      if (handle.created) executionRef.current += 1
      return { created: handle.created, execution: executionRef.current, scope }
    },
    [scope],
  )
  const isCurrent = useCallback(
    (attempt: TToggleAttempt): boolean =>
      mountedRef.current &&
      renderedScopeRef.current === attempt.scope &&
      executionRef.current === attempt.execution,
    [],
  )
  const reportFailure = useCallback(
    (attempt: TToggleAttempt, requestError: unknown, fallbackMessage: string): void => {
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
