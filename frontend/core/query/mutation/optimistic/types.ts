import type { QueryClient, QueryKey } from '@tanstack/react-query'

export type TQueryTarget = {
  queryKey: QueryKey
  exact?: boolean
}

export type TOptimisticChange =
  | {
      type: 'field'
      queryKey: QueryKey
      entityKey: string
      field: string
      before: unknown
      optimistic: unknown
      commandId: string
      rollback:
        | 'restore-if-owned-and-value-matches'
        | 'restore-if-owned-value-and-revision-match'
        | 'refetch'
      commit: () => void
      restore: () => void
    }
  | {
      type: 'entity-delete'
      queryKey: QueryKey
      entityKey: string
      commandId: string
      rollback: 'restore-if-owned-and-absent'
      commit: () => void
      restore: () => void
    }
  | {
      type: 'pending-entity'
      queryKey: QueryKey
      entityKey: `pending:${string}`
      commandId: string
      rollback: 'remove-if-owned'
      commit: () => void
      restore: () => void
    }

export type TAuthorityTarget = {
  queryKey: QueryKey
}

export type TOptimisticPlan = {
  changes: readonly TOptimisticChange[]
}

/** Context available while deriving current state; no command has started yet. */
export type TReadOperationContext = {
  queryClient: QueryClient
  accountScope: string | null
}

/** Context available after the executor has assigned the command identity. */
export type TOperationContext = TReadOperationContext & {
  commandId: string
}

export type TOptimisticOperation<TTarget, TInput, TResult> = {
  name: string
  entityKey: (target: TTarget) => string
  queueKey?: (target: TTarget) => string
  queriesToCancel: (
    context: TOperationContext,
    target: TTarget,
    input: TInput,
  ) => readonly TQueryTarget[]
  authorityTargets: (
    context: TOperationContext,
    target: TTarget,
    input: TInput,
  ) => readonly TAuthorityTarget[]
  prepare?: (context: TOperationContext, target: TTarget, input: TInput) => TOptimisticPlan
  execute: (context: TOperationContext, target: TTarget, input: TInput) => Promise<TResult>
  reconcile: (context: TOperationContext, target: TTarget, input: TInput, result: TResult) => void
}

export type TOptimisticToggleOperation<TTarget, TResult> = TOptimisticOperation<
  TTarget,
  boolean,
  TResult
> & {
  read: (context: TReadOperationContext, target: TTarget) => boolean
}
