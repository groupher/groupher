import type {
  TPublishPlan,
  TPublishPlanAction,
  TPublishChecklist,
  TPublishChecklistItem,
  TPublishSelectedInput,
} from './spec'

/** Returns checklist items for the frontend shared workflow. */
export const getChecklistItems = (checklist: TPublishChecklist | null): TPublishChecklistItem[] => [
  ...(checklist?.docChanges ?? []),
  ...(checklist?.treeChanges ?? []),
]

/** Reports whether selectable checklist items at the frontend shared boundary. */
export const hasSelectableChecklistItems = (checklist: TPublishChecklist | null): boolean =>
  getChecklistItems(checklist).some((item) => item.selectable)

/** Returns default selected ids for the frontend shared workflow. */
export const getDefaultSelectedIds = (items: readonly TPublishChecklistItem[]): string[] =>
  items.filter((item) => item.selectable && item.selectedByDefault).map((item) => item.id)

/** Returns checklist item ids for the frontend shared workflow. */
export const getChecklistItemIds = (items: readonly TPublishChecklistItem[]): Set<string> =>
  new Set(items.map((item) => item.id))

/** Runs the reconcile selected ids operation at the frontend shared boundary. */
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

/** Returns selected publish count for the frontend shared workflow. */
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

/** Reports whether delete checklist item at the frontend shared boundary. */
export const isDeleteChecklistItem = (item: TPublishChecklistItem): boolean =>
  item.action === 'deleted'

/** Returns restore tree change ids for the frontend shared workflow. */
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

/** Returns publish plan for the frontend shared workflow. */
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

/** Returns publish plan action for the frontend shared workflow. */
export const getPublishPlanAction = (plan: TPublishPlan): TPublishPlanAction => {
  const hasPublishItems = plan.publishItems.length > 0
  const hasRestoreItems = plan.restoreItems.length > 0

  if (hasPublishItems && hasRestoreItems) return 'apply'
  if (hasRestoreItems) return 'restore'
  if (hasPublishItems) return 'publish'

  return 'noop'
}

/** Returns publish input action for the frontend shared workflow. */
export const getPublishInputAction = (input: TPublishSelectedInput): TPublishPlanAction => {
  const hasPublishItems = input.docChangeIds.length > 0 || input.treeChangeIds.length > 0
  const hasRestoreItems = input.restoreTreeChangeIds.length > 0

  if (hasPublishItems && hasRestoreItems) return 'apply'
  if (hasRestoreItems) return 'restore'
  if (hasPublishItems) return 'publish'

  return 'noop'
}

/** Runs the format publish count label operation at the frontend shared boundary. */
export const formatPublishCountLabel = (
  selectedCount: number,
  totalCount: number,
): string | null => {
  if (totalCount <= 0 || selectedCount <= 0) return null

  return selectedCount === totalCount ? String(totalCount) : `${selectedCount}/${totalCount}`
}

type TTreeChangeSummaryArgs = {
  checklist: TPublishChecklist | null
  fallbackCount: number
  checkingLabel: string
  noChangesLabel: string
  detectedLabel: string
  changePendingLabel: string
  changesPendingLabel: string
}

/** Runs the format tree change summary operation at the frontend shared boundary. */
export const formatTreeChangeSummary = ({
  checklist,
  fallbackCount,
  checkingLabel,
  noChangesLabel,
  detectedLabel,
  changePendingLabel,
  changesPendingLabel,
}: TTreeChangeSummaryArgs): string => {
  if (!checklist) return checkingLabel

  const treeChanges = checklist.treeChanges
  const totalCount = checklist.totalCount || fallbackCount
  const singleTreeChange =
    treeChanges.length === 1 && checklist.docChanges.length === 0 ? treeChanges[0] : null

  if (singleTreeChange?.action === 'deleted') {
    return `${detectedLabel} ${singleTreeChange.title}`
  }

  const count = Math.max(totalCount, treeChanges.length, checklist.docChanges.length)

  if (count <= 0) return noChangesLabel
  if (count === 1) return `1 ${changePendingLabel}`

  return `${count} ${changesPendingLabel}`
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
