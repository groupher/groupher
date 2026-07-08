import type { TMarkerValue } from './marker'

export type TDocPublicTreeNodeType = 'GROUP' | 'PAGE' | 'LINK' | 'group' | 'page' | 'link'

export type TDocPublicTreeItem = {
  id: string
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

export type TDocPublicTree = {
  groups: readonly TDocPublicTreeGroup[]
}

export type TDocPublicTreeQuery = {
  docPublicTree?: TDocPublicTree | null
}
