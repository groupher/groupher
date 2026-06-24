import type { TDocCoverLayout, TMarkerValue } from '~/spec'

export type TDocCoverNodeType = 'page' | 'link' | 'PAGE' | 'LINK'

export type TDocCoverGroupUiConfig = {
  layout?: TDocCoverLayout | null
  marker?: TMarkerValue | null
  desc?: string | null
}

export type TDocCoverItemUiConfig = {
  digest?: string | null
}

export type TDocCoverItem = {
  id: string
  nodeId: string
  docId?: string | null
  type: TDocCoverNodeType
  title: string
  digest?: string | null
  href: string
  index: number
  marker?: TMarkerValue | null
  badge?: string | null
  uiConfig?: TDocCoverItemUiConfig | null
}

export type TDocCoverGroup = {
  id: string
  groupId: string
  index: number
  title: string
  uiConfig?: TDocCoverGroupUiConfig | null
  items: readonly TDocCoverItem[]
}

export type TDocCoversData = {
  groups: readonly TDocCoverGroup[]
  pinnedItems: readonly TDocCoverItem[]
}

export type TDocCoverLayoutProps = {
  groups: readonly TDocCoverGroup[]
  pinnedItems?: readonly TDocCoverItem[]
  editable?: boolean
  onEditGroup?: (group: TDocCoverGroup) => void
}

export type TDocCoversProps = {
  layout: TDocCoverLayout
  data: TDocCoversData
  editable?: boolean
  onEditGroup?: (group: TDocCoverGroup) => void
}
