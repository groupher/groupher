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
  /**
   * Stable logical `node_id` exposed by GraphQL. The physical database row
   * `id` is intentionally not exposed to public navigation code.
   */
  id: string
  /** Direct parent's logical `node_id`, not the parent's physical row `id`. */
  parentNodeId?: string | null
  docId?: string | null
  type: TDocPublicTreeNodeType
  title?: string | null
  index?: number | null
  href?: string | null
  marker?: TMarkerValue | null
  badge?: string | null
}

export type TDocPublicTreeGroup = TDocPublicTreeItem & {
  pages?: readonly TDocPublicTreeNavigationNode[] | null
}

export type TDocPublicTreeNavigationNode = TDocPublicTreeGroup | TDocPublicTreeItem

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
