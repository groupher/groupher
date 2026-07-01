import type { TPublishScope, TPublishScopeItem } from './spec'

export const getScopeItems = (scope: TPublishScope | null): TPublishScopeItem[] => [
  ...(scope?.docChanges ?? []),
  ...(scope?.treeChanges ?? []),
]

export const hasSelectableScopeItems = (scope: TPublishScope | null): boolean =>
  getScopeItems(scope).some((item) => item.selectable)

/**
 * Toggle one publish-scope item id while keeping the checked ids as opaque API ids.
 *
 * @example
 * toggleId(['doc:1'], 'doc:2') // ['doc:1', 'doc:2']
 */
export const toggleId = (ids: readonly string[], id: string): string[] => {
  if (ids.includes(id)) return ids.filter((item) => item !== id)

  return [...ids, id]
}
