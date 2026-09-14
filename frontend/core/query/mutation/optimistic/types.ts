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
      rollback: 'restore-if-owned' | 'refetch'
      restore: () => void
    }
  | {
      type: 'pending-entity'
      queryKey: QueryKey
      entityKey: `pending:${string}`
      commandId: string
      rollback: 'remove-if-owned'
      restore: () => void
    }

export type TAuthorityRefetch = {
  queryKey: QueryKey
  exact: true
}

export type TOptimisticPlan = {
  changes: readonly TOptimisticChange[]
  refetchOnFailure: readonly TAuthorityRefetch[]
}

/** Context available while deriving current state; no command has started yet. */
export type TReadOperationContext = {
  queryClient: QueryClient
  accountRef: string | null
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
  apply: (context: TOperationContext, target: TTarget, input: TInput) => TOptimisticPlan
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
