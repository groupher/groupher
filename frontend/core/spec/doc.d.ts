import type { TMarkerValue } from './marker'

export type TDocPublicTreeNodeType =
  | 'TAB'
  | 'PIN'
  | 'GROUP'
  | 'PAGE'
  | 'LINK'
  | 'tab'
  | 'pin'
  | 'group'
  | 'page'
  | 'link'

export type TDocPublicTreeItem = {
  id: string
  tabId?: string | null
  groupId?: string | null
  docId?: string | null
  type: TDocPublicTreeNodeType
  title?: string | null
  slug?: string | null
  index?: number | null
  href?: string | null
  marker?: TMarkerValue | null
  badge?: string | null
}

export type TDocPublicTreeGroup = TDocPublicTreeItem & {
  children?: readonly TDocPublicTreeItem[] | null
}

export type TDocPublicTreeTab = TDocPublicTreeItem & {
  pins: readonly TDocPublicTreeItem[]
  groups: readonly TDocPublicTreeGroup[]
}

export type TDocPublicTree = {
  tabs: readonly TDocPublicTreeTab[]
}

export type TDocPublicTreeQuery = {
  docPublicTree?: TDocPublicTree | null
}
