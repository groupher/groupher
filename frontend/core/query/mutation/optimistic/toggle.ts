import type { QueryClient } from '@tanstack/react-query'

import { executeOptimisticOperation } from './execute'
import type { TOptimisticToggleOperation, TReadOperationContext } from './types'

type TToggleIntent = {
  pendingState: boolean
  promise: Promise<unknown>
}

const intents = new WeakMap<QueryClient, Map<string, TToggleIntent>>()

const getIntents = (queryClient: QueryClient): Map<string, TToggleIntent> => {
  let map = intents.get(queryClient)
  if (!map) {
    map = new Map()
    intents.set(queryClient, map)
  }
  return map
}

/** Executes a set-state toggle with one shared last-intent buffer per account/entity. */
export const enqueueOptimisticToggle = <TTarget, TResult>({
  queryClient,
  accountRef,
  operation,
  target,
  next,
}: {
  queryClient: QueryClient
  accountRef: string
  operation: TOptimisticToggleOperation<TTarget, TResult>
  target: TTarget
  next?: boolean
}): Promise<TResult | void> => {
  const context: TReadOperationContext = { queryClient, accountRef }
  const key = `${accountRef}:${operation.name}:${operation.entityKey(target)}`
  const map = getIntents(queryClient)
  const active = map.get(key)
  const current = active?.pendingState ?? operation.read(context, target)
  const nextState = next ?? !current
  // A set-state intent that already matches the known server state does not
  // create an execute attempt or commandId.
  if (!active && nextState === current) return Promise.resolve(undefined)
  if (active) {
    active.pendingState = nextState
    return active.promise as Promise<TResult | void>
  }

  const intent: TToggleIntent = { pendingState: nextState, promise: Promise.resolve() }
  intent.promise = (async () => {
    let applied: boolean | undefined
    let result: TResult | undefined
    do {
      applied = intent.pendingState
      result = await executeOptimisticOperation({
        queryClient,
        accountRef,
        operation,
        target,
        input: applied,
      })
    } while (intent.pendingState !== applied)
    return result
  })().then(
    (value) => {
      if (map.get(key) === intent) map.delete(key)
      return value
    },
    (error) => {
      if (map.get(key) === intent) map.delete(key)
      throw error
    },
  )
  map.set(key, intent)
  return intent.promise as Promise<TResult | void>
}
