export type TPublishScopeItem = {
  id: string
  title: string
  action: string
  selectedByDefault: boolean
  selectable: boolean
  disabledReason?: string | null
}

export type TPublishScope = {
  totalCount: number
  docChanges: TPublishScopeItem[]
  treeChanges: TPublishScopeItem[]
}

export type TPublishChangesData = {
  publishDocChanges?: {
    scope?: TPublishScope | null
  } | null
}

export type TPublishSelectedInput = {
  docChangeIds: string[]
  treeChangeIds: string[]
}
