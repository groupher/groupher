import type { QueryClient } from '@tanstack/react-query'

import { invalidateExact } from '../../invalidation'
import { clearChanges, markChange, rollbackChanges } from './effects'
import { isOptimisticCacheError, OptimisticCacheError } from './errors'
import type { TAuthorityTarget, TOptimisticPlan, TOptimisticOperation, TQueryTarget } from './types'

/**
 * Creates the client command identity used by the mutation executor.
 *
 * Components and domain hooks must not call this primitive directly. They
 * should use `executeCommand` or `executeOptimisticOperation` so retry identity
 * stays owned by the executor.
 *
 * @example
 * const data = await executeCommand({ request, variables })
 */
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

export type TCommandVariables<TVariables extends { commandId: string | number }> = Omit<
  TVariables,
  'commandId'
>

export type TCommandHandle<TVariables extends { commandId: string | number }> = {
  commandId: string
  variables: TCommandVariables<TVariables>
  status: 'pending' | 'unknown'
}

/**
 * Starts a command handle for coordinators that span multiple transport calls.
 *
 * @example
 * const handle = createCommandHandle({ operation: 'wallpaper.publish' })
 */
export const createCommandHandle = (variables: Record<string, unknown>) => ({
  commandId: createCommandId(),
  variables: Object.freeze({ ...variables }),
  status: 'pending' as const,
})

export type TExecuteCommandArgs<TVariables extends { commandId: string | number }, TResult> = {
  request: (variables: TVariables) => Promise<TResult>
  variables: TCommandVariables<TVariables>
  commandId?: string
}

/**
 * Executes one command mutation and injects its identity at the transport boundary.
 * The optional identity is reserved for bounded retry/recovery of the same attempt.
 *
 * @example
 * const result = await executeCommand({
 *   request: (variables) => browserGraphQLRequest(UpdatePost, variables),
 *   variables: { article, expectedVersion, title },
 * })
 */
export const executeCommand = async <TVariables extends { commandId: string | number }, TResult>({
  request,
  variables,
  commandId,
}: TExecuteCommandArgs<TVariables, TResult>): Promise<TResult> =>
  request({ ...variables, commandId: commandId || createCommandId() } as TVariables)

const operationQueues = new WeakMap<QueryClient, Map<string, Promise<unknown>>>()
const pendingCalibrations = new WeakMap<
  QueryClient,
  Map<string, { target: TAuthorityTarget; promise: Promise<void> }>
>()

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
  accountScope: string | null
  operation: TOptimisticOperation<TTarget, TInput, TResult>
  target: TTarget
  input: TInput
  commandId?: string
}

const diagnose = (message: string, details: Record<string, unknown>): void => {
  try {
    console.error(`[optimistic-operation] ${message}`, details)
  } catch {
    // Diagnostics must never change a command result.
  }
}

const causeName = (error: unknown): string => {
  if (error instanceof OptimisticCacheError && error.cause !== undefined)
    return causeName(error.cause)
  return error instanceof Error ? error.name : typeof error
}

const uniqueAuthorityTargets = (targets: readonly TAuthorityTarget[]): TAuthorityTarget[] => [
  ...new Map(targets.map((target) => [JSON.stringify(target.queryKey), target])).values(),
]

const cancellationMatches = (cancelTarget: TQueryTarget, target: TAuthorityTarget): boolean => {
  const cancelKey = cancelTarget.queryKey
  const authorityKey = target.queryKey
  if (cancelTarget.exact && cancelKey.length !== authorityKey.length) return false
  if (cancelKey.length > authorityKey.length) return false
  return cancelKey.every(
    (part, index) => JSON.stringify(part) === JSON.stringify(authorityKey[index]),
  )
}

const getPendingCalibrationTargets = (
  queryClient: QueryClient,
  cancelTargets: readonly TQueryTarget[],
): TAuthorityTarget[] => {
  const calibrations = pendingCalibrations.get(queryClient)
  if (!calibrations) return []
  return uniqueAuthorityTargets(
    [...calibrations.values()]
      .filter(({ target }) =>
        cancelTargets.some((cancelTarget) => cancellationMatches(cancelTarget, target)),
      )
      .map(({ target }) => target),
  )
}

const calibrate = async (
  queryClient: QueryClient,
  targets: readonly TAuthorityTarget[],
  context: { operation: string; commandId: string },
): Promise<void> => {
  try {
    await invalidateExact(queryClient, uniqueAuthorityTargets(targets))
  } catch (error) {
    diagnose('authority calibration could not be scheduled', {
      ...context,
      causeName: causeName(error),
    })
  }
}

/** Runs one typed operation through cancel, prepare, commit, transport, reconcile, and cleanup. */
export const executeOptimisticOperation = async <TTarget, TInput, TResult>({
  queryClient,
  accountScope,
  operation,
  target,
  input,
  commandId,
}: TExecuteOptimisticOperationArgs<TTarget, TInput, TResult>): Promise<TResult> => {
  const queueKey =
    operation.queueKey?.(target) || `${operation.name}:${operation.entityKey(target)}`
  const lane = `${accountScope || 'anonymous'}:${queueKey}`

  return enqueue(queryClient, lane, async () => {
    const context = { queryClient, accountScope, commandId: commandId || createCommandId() }
    const cancelTargets = operation.queriesToCancel(context, target, input)
    const authorityTargets = operation.authorityTargets(context, target, input)
    const pendingCalibrationTargets = new Map<string, TAuthorityTarget>()
    const requestCalibration = (targets: readonly TAuthorityTarget[]): void => {
      for (const authorityTarget of uniqueAuthorityTargets(targets)) {
        const key = JSON.stringify(authorityTarget.queryKey)
        pendingCalibrationTargets.set(key, authorityTarget)
      }
    }
    const scheduleCalibration = (): void => {
      const pending = [...pendingCalibrationTargets.values()]
      if (pending.length === 0) return
      pendingCalibrationTargets.clear()
      let calibrations = pendingCalibrations.get(queryClient)
      if (!calibrations) {
        calibrations = new Map()
        pendingCalibrations.set(queryClient, calibrations)
      }
      for (const target of pending) {
        const key = JSON.stringify(target.queryKey)
        const previous = calibrations.get(key)?.promise
        const calibration = previous
          ? previous.then(() =>
              calibrate(queryClient, [target], {
                operation: operation.name,
                commandId: context.commandId,
              }),
            )
          : Promise.resolve().then(() =>
              calibrate(queryClient, [target], {
                operation: operation.name,
                commandId: context.commandId,
              }),
            )
        calibrations.set(key, { target, promise: calibration })
        void calibration.then(() => {
          if (calibrations?.get(key)?.promise === calibration) calibrations.delete(key)
        })
      }
    }
    // A new action may cancel an in-flight recovery refetch. Carry that target
    // forward so recovery is re-scheduled after this action settles, without
    // blocking independent lanes on a slow or paused network request.
    requestCalibration(getPendingCalibrationTargets(queryClient, cancelTargets))
    await Promise.all(cancelTargets.map((target) => queryClient.cancelQueries(target)))

    let plan: TOptimisticPlan = { changes: [] }
    try {
      plan = operation.prepare?.(context, target, input) ?? { changes: [] }
    } catch (error) {
      requestCalibration(authorityTargets)
      if (!isOptimisticCacheError(error)) {
        scheduleCalibration()
        throw error
      }
      diagnose('optimistic preparation degraded to command-only execution', {
        operation: operation.name,
        commandId: context.commandId,
        causeName: causeName(error),
      })
    }

    if (plan.changes.length) {
      for (const change of plan.changes) markChange(queryClient, change)
      try {
        for (const change of plan.changes) change.commit()
      } catch (error) {
        const cleanupFailures = rollbackChanges(queryClient, plan.changes)
        diagnose('optimistic commit failed and cleanup was attempted', {
          operation: operation.name,
          commandId: context.commandId,
          causeName: causeName(error),
          cleanupFailureCount: cleanupFailures.length,
          cleanupFailureNames: cleanupFailures.map(causeName),
        })
        requestCalibration(authorityTargets)
        if (!isOptimisticCacheError(error)) {
          scheduleCalibration()
          throw error
        }
        // A recognized cache-only commit failure drops the optimistic effect
        // and lets the server result own the outcome.
        plan = { changes: [] }
      }
    }

    let result: TResult
    try {
      result = await operation.execute(context, target, input)
    } catch (error) {
      const cleanupFailures = rollbackChanges(queryClient, plan.changes)
      diagnose('command failed; optimistic cleanup was attempted', {
        operation: operation.name,
        commandId: context.commandId,
        causeName: causeName(error),
        cleanupFailureCount: cleanupFailures.length,
        cleanupFailureNames: cleanupFailures.map(causeName),
      })
      requestCalibration(authorityTargets)
      scheduleCalibration()
      throw error
    }

    // A committed mutation is never turned into a failure because local cache
    // reconciliation/storage failed. Re-fetch the affected authority targets
    // as a safe convergence fallback, then return the confirmed result.
    try {
      operation.reconcile(context, target, input, result)
    } catch (error) {
      diagnose('confirmed command could not reconcile locally', {
        operation: operation.name,
        commandId: context.commandId,
        causeName: causeName(error),
      })
      requestCalibration(authorityTargets)
    } finally {
      try {
        clearChanges(queryClient, plan.changes)
      } catch (error) {
        diagnose('optimistic ownership cleanup failed after command confirmation', {
          operation: operation.name,
          commandId: context.commandId,
          causeName: causeName(error),
        })
        requestCalibration(authorityTargets)
      }
    }
    scheduleCalibration()
    return result
  })
}
