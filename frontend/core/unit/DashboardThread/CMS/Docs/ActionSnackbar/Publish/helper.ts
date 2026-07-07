import type {
  TPublishPlan,
  TPublishPlanAction,
  TPublishChecklist,
  TPublishChecklistItem,
  TPublishSelectedInput,
} from './spec'

export const getChecklistItems = (checklist: TPublishChecklist | null): TPublishChecklistItem[] => [
  ...(checklist?.docChanges ?? []),
  ...(checklist?.treeChanges ?? []),
]

export const hasSelectableChecklistItems = (checklist: TPublishChecklist | null): boolean =>
  getChecklistItems(checklist).some((item) => item.selectable)

export const getDefaultSelectedIds = (items: readonly TPublishChecklistItem[]): string[] =>
  items.filter((item) => item.selectable && item.selectedByDefault).map((item) => item.id)

export const getChecklistItemIds = (items: readonly TPublishChecklistItem[]): Set<string> =>
  new Set(items.map((item) => item.id))

export const reconcileSelectedIds = (
  items: readonly TPublishChecklistItem[],
  currentIds: readonly string[],
  seenIds: ReadonlySet<string>,
): string[] => {
  const selectableIds = new Set(items.filter((item) => item.selectable).map((item) => item.id))
  const selectedIds = new Set(currentIds.filter((id) => selectableIds.has(id)))

  for (const item of items) {
    if (item.selectable && item.selectedByDefault && !seenIds.has(item.id)) {
      selectedIds.add(item.id)
    }
  }

  return Array.from(selectedIds)
}

export const getSelectedPublishCount = (
  checklist: TPublishChecklist | null,
  selectedDocIds: readonly string[],
  selectedTreeIds: readonly string[],
): number => {
  if (!checklist) return 0

  const selectedDocIdSet = new Set(selectedDocIds)
  const selectedTreeIdSet = new Set(selectedTreeIds)

  return (
    checklist.docChanges.filter((item) => item.selectable && selectedDocIdSet.has(item.id)).length +
    checklist.treeChanges.filter((item) => item.selectable && selectedTreeIdSet.has(item.id)).length
  )
}

export const isDeleteChecklistItem = (item: TPublishChecklistItem): boolean =>
  item.action === 'deleted'

export const getRestoreTreeChangeIds = (
  checklist: TPublishChecklist | null,
  selectedTreeIds: readonly string[],
): string[] => {
  if (!checklist) return []

  const selectedTreeIdSet = new Set(selectedTreeIds)

  return checklist.treeChanges
    .filter(
      (item) => item.selectable && isDeleteChecklistItem(item) && !selectedTreeIdSet.has(item.id),
    )
    .map((item) => item.id)
}

export const getPublishPlan = (
  checklist: TPublishChecklist | null,
  selectedDocIds: readonly string[],
  selectedTreeIds: readonly string[],
): TPublishPlan => {
  if (!checklist) {
    return {
      publishItems: [],
      restoreItems: [],
      keptDraftItems: [],
    }
  }

  const selectedDocIdSet = new Set(selectedDocIds)
  const selectedTreeIdSet = new Set(selectedTreeIds)
  const publishItems = [
    ...checklist.docChanges.filter((item) => item.selectable && selectedDocIdSet.has(item.id)),
    ...checklist.treeChanges.filter((item) => item.selectable && selectedTreeIdSet.has(item.id)),
  ]
  const restoreItems = checklist.treeChanges.filter(
    (item) => item.selectable && isDeleteChecklistItem(item) && !selectedTreeIdSet.has(item.id),
  )
  const keptDraftItems = [
    ...checklist.docChanges.filter((item) => item.selectable && !selectedDocIdSet.has(item.id)),
    ...checklist.treeChanges.filter(
      (item) => item.selectable && !isDeleteChecklistItem(item) && !selectedTreeIdSet.has(item.id),
    ),
  ]

  return {
    publishItems,
    restoreItems,
    keptDraftItems,
  }
}

export const getPublishPlanAction = (plan: TPublishPlan): TPublishPlanAction => {
  const hasPublishItems = plan.publishItems.length > 0
  const hasRestoreItems = plan.restoreItems.length > 0

  if (hasPublishItems && hasRestoreItems) return 'apply'
  if (hasRestoreItems) return 'restore'
  if (hasPublishItems) return 'publish'

  return 'noop'
}

export const getPublishInputAction = (input: TPublishSelectedInput): TPublishPlanAction => {
  const hasPublishItems = input.docChangeIds.length > 0 || input.treeChangeIds.length > 0
  const hasRestoreItems = input.restoreTreeChangeIds.length > 0

  if (hasPublishItems && hasRestoreItems) return 'apply'
  if (hasRestoreItems) return 'restore'
  if (hasPublishItems) return 'publish'

  return 'noop'
}

export const formatPublishCountLabel = (
  selectedCount: number,
  totalCount: number,
): string | null => {
  if (totalCount <= 0 || selectedCount <= 0) return null

  return selectedCount === totalCount ? String(totalCount) : `${selectedCount}/${totalCount}`
}

/**
 * Toggle one publish-checklist item id while keeping the checked ids as opaque API ids.
 *
 * @example
 * toggleId(['doc:1'], 'doc:2') // ['doc:1', 'doc:2']
 */
export const toggleId = (ids: readonly string[], id: string): string[] => {
  if (ids.includes(id)) return ids.filter((item) => item !== id)

  return [...ids, id]
}
