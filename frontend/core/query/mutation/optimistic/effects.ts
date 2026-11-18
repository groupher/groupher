import type { QueryClient, QueryKey } from '@tanstack/react-query'

import type { TOptimisticChange } from './types'

type TMarkerKey = string

const markers = new WeakMap<QueryClient, Map<TMarkerKey, string>>()

const markerKey = (queryKey: QueryKey, entityKey: string, field: string): TMarkerKey =>
  JSON.stringify([queryKey, entityKey, field])

const markerMap = (queryClient: QueryClient): Map<TMarkerKey, string> => {
  let map = markers.get(queryClient)
  if (!map) {
    map = new Map()
    markers.set(queryClient, map)
  }
  return map
}

const markerField = (change: TOptimisticChange): string =>
  change.type === 'field' ? `${change.type}:${change.field}` : change.type

/** Records the operation marker that owns an optimistic field/entity change. */
export const markChange = (queryClient: QueryClient, change: TOptimisticChange): void => {
  markerMap(queryClient).set(
    markerKey(change.queryKey, change.entityKey, markerField(change)),
    change.commandId,
  )
}

const ownsChange = (queryClient: QueryClient, change: TOptimisticChange): boolean =>
  markerMap(queryClient).get(markerKey(change.queryKey, change.entityKey, markerField(change))) ===
  change.commandId

const clearChange = (queryClient: QueryClient, change: TOptimisticChange): void => {
  const key = markerKey(change.queryKey, change.entityKey, markerField(change))
  if (ownsChange(queryClient, change)) markerMap(queryClient).delete(key)
}

/** Rolls back only changes whose ownership marker still belongs to this operation. */
export const rollbackChanges = (
  queryClient: QueryClient,
  changes: readonly TOptimisticChange[],
): unknown[] => {
  const failures: unknown[] = []
  for (const change of changes) {
    if (ownsChange(queryClient, change)) {
      // Non-invertible public aggregate changes use refetch; invertible changes
      // supply their value or value/revision guard in the domain restore callback.
      if (change.type === 'pending-entity' || change.rollback !== 'refetch') {
        try {
          change.restore()
        } catch (error) {
          failures.push(error)
        }
      }
      clearChange(queryClient, change)
    }
  }
  return failures
}

/** Clears operation markers after reconcile or rollback without changing Query data. */
export const clearChanges = (
  queryClient: QueryClient,
  changes: readonly TOptimisticChange[],
): void => {
  for (const change of changes) clearChange(queryClient, change)
}
