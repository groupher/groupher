export type TPublishChecklistItem = {
  id: string
  title: string
  action: string
  selectedByDefault: boolean
  selectable: boolean
  disabledReason?: string | null
}

export type TPublishChecklist = {
  totalCount: number
  docChanges: TPublishChecklistItem[]
  treeChanges: TPublishChecklistItem[]
}

export type TPublishPlan = {
  publishItems: TPublishChecklistItem[]
  restoreItems: TPublishChecklistItem[]
  keptDraftItems: TPublishChecklistItem[]
}

export type TPublishPlanAction = 'publish' | 'restore' | 'apply' | 'noop'

export type TPublishChangesData = {
  publishDocChanges?: {
    checklist?: TPublishChecklist | null
  } | null
}

export type TPublishSelectedInput = {
  docChangeIds: string[]
  treeChangeIds: string[]
  restoreTreeChangeIds: string[]
}
