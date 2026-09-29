import type { QueryClient } from '@tanstack/react-query'

import { clearChanges, markChange, rollbackChanges } from './effects'
import type { TOptimisticPlan, TOptimisticOperation } from './types'

/** Creates the client command identity used for pending entities and retries. */
export const createCommandId = (): string => {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  // GraphQL forwards commandId to an Ecto.UUID field, so every generated id
  // must retain UUID shape even when randomUUID is unavailable.
  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes)
  } else {
    // Last-resort UUID generation for runtimes without Web Crypto. This id is
    // an idempotency identity, not an authorization token.
    for (let index = 0; index < bytes.length; index += 1)
      bytes[index] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const operationQueues = new WeakMap<QueryClient, Map<string, Promise<unknown>>>()

const enqueue = <T>(queryClient: QueryClient, key: string, run: () => Promise<T>): Promise<T> => {
  let queues = operationQueues.get(queryClient)
  if (!queues) {
    queues = new Map()
    operationQueues.set(queryClient, queues)
  }
  const previous = queues.get(key) || Promise.resolve()
  const current = previous.catch(() => undefined).then(run)
  queues.set(key, current)
  void current.then(
    () => {
      if (queues?.get(key) === current) queues.delete(key)
    },
    () => {
      if (queues?.get(key) === current) queues.delete(key)
    },
  )
  return current
}

export type TExecuteOptimisticOperationArgs<TTarget, TInput, TResult> = {
  queryClient: QueryClient
  accountRef: string | null
  operation: TOptimisticOperation<TTarget, TInput, TResult>
  target: TTarget
  input: TInput
  commandId?: string
}

/** Runs one typed operation through cancel, optimistic apply, transport, reconcile, and rollback. */
export const executeOptimisticOperation = async <TTarget, TInput, TResult>({
  queryClient,
  accountRef,
  operation,
  target,
  input,
  commandId,
}: TExecuteOptimisticOperationArgs<TTarget, TInput, TResult>): Promise<TResult> => {
  const queueKey =
    operation.queueKey?.(target) || `${operation.name}:${operation.entityKey(target)}`
  const lane = `${accountRef || 'anonymous'}:${queueKey}`

  return enqueue(queryClient, lane, async () => {
    const context = { queryClient, accountRef, commandId: commandId || createCommandId() }
    const cancelTargets = operation.queriesToCancel(context, target, input)
    await Promise.all(cancelTargets.map((target) => queryClient.cancelQueries(target)))

    const plan: TOptimisticPlan = operation.apply(context, target, input)
    for (const change of plan.changes) markChange(queryClient, change)

    let result: TResult
    try {
      result = await operation.execute(context, target, input)
    } catch (error) {
      rollbackChanges(queryClient, plan.changes)
      await Promise.all(
        plan.refetchOnFailure.map((target) =>
          queryClient.refetchQueries({ ...target, type: 'active' }),
        ),
      )
      throw error
    }

    // A committed mutation is never turned into a failure because local cache
    // reconciliation/storage failed. Re-fetch the affected authority targets
    // as a safe convergence fallback, then return the confirmed result.
    try {
      operation.reconcile(context, target, input, result)
    } catch {
      await Promise.all(
        plan.refetchOnFailure.map((target) =>
          queryClient.refetchQueries({ ...target, type: 'active' }),
        ),
      )
    } finally {
      clearChanges(queryClient, plan.changes)
    }
    return result
  })
}
