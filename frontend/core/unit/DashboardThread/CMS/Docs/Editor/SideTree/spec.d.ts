import type { TMarkerValue } from '~/spec'

import type {
  SIDE_TREE_CHILD_MENU_ACTION,
  SIDE_TREE_GROUP_MENU_ACTION,
  SIDE_TREE_NODE_MENU_ACTION,
  SIDE_TREE_NODE_TYPE,
} from './constant'

export type TSideTreeNodeType = (typeof SIDE_TREE_NODE_TYPE)[keyof typeof SIDE_TREE_NODE_TYPE]

export type TSideTreeChildType = typeof SIDE_TREE_NODE_TYPE.PAGE | typeof SIDE_TREE_NODE_TYPE.LINK

export type TDocTreeNodePublishState = {
  status?: 'draft' | 'public' | null
  published: boolean
  publishedBefore?: boolean | null
  publishedNodeId?: string | null
  publishedDocId?: string | null
  hasUnpublishedChanges?: boolean | null
  lastPublishedAt?: string | null
  inCover?: boolean | null
  hiddenFromCover?: boolean | null
  pinnedToCover?: boolean | null
}

type TSideTreePublishable = {
  publishState?: TDocTreeNodePublishState | null
}

export type TSideTreeGroup = {
  id: string
  type: typeof SIDE_TREE_NODE_TYPE.GROUP
  title: string
  slug?: string
  marker?: TMarkerValue
  hidden?: boolean
  expanded?: boolean
  children: readonly TSideTreeChild[]
} & TSideTreePublishable

export type TSideTreePage = {
  id: string
  type: typeof SIDE_TREE_NODE_TYPE.PAGE
  title?: string
  slug?: string
  docId?: string
  path?: string
  href?: string
  marker?: TMarkerValue
  badge?: string
  hidden?: boolean
} & TSideTreePublishable

export type TSideTreeLink = {
  id: string
  type: typeof SIDE_TREE_NODE_TYPE.LINK
  title: string
  slug?: string
  href: string
  marker?: TMarkerValue
  badge?: string
  hidden?: boolean
} & TSideTreePublishable

export type TSideTreeChild = TSideTreePage | TSideTreeLink
export type TSideTreeLinkInput = Pick<TSideTreeLink, 'href' | 'title'>

export type TEditingTarget =
  | { type: typeof SIDE_TREE_NODE_TYPE.GROUP; groupId: string }
  | { type: TSideTreeChildType; groupId: string; childId: string }
  | null

export type TSideTreeChildMenuAction =
  (typeof SIDE_TREE_CHILD_MENU_ACTION)[keyof typeof SIDE_TREE_CHILD_MENU_ACTION]
export type TSideTreeGroupMenuAction =
  (typeof SIDE_TREE_GROUP_MENU_ACTION)[keyof typeof SIDE_TREE_GROUP_MENU_ACTION]
export type TSideTreeNodeMenuAction =
  (typeof SIDE_TREE_NODE_MENU_ACTION)[keyof typeof SIDE_TREE_NODE_MENU_ACTION]

export type TSideTreeController = {
  groups: TSideTreeGroup[]
  activeId: string | null
  editingTarget: TEditingTarget
  coverWarning: string | null
  activate: (id: string) => void
  addGroup: () => void
  addChild: (groupId: string, action: TSideTreeChildMenuAction) => void
  clearCoverWarning: () => void
  deleteGroup: (groupId: string) => void
  toggleGroup: (groupId: string) => void
  toggleCoverGroup: (groupId: string, inCover: boolean) => void
  publishGroup: (groupId: string) => void
  moveGroupToDraft: (groupId: string) => void
  renameGroup: (groupId: string, title: string) => void
  renameChild: (groupId: string, childId: string, title: string) => void
  renameLink: (groupId: string, childId: string, input: TSideTreeLinkInput) => void
  cancelEdit: () => void
  edit: (target: TEditingTarget) => void
  handleChildAction: (groupId: string, childId: string, action: TSideTreeNodeMenuAction) => void
  updateChildStyle: (groupId: string, childId: string, marker: TSideTreeChild['marker']) => void
  patchChild: (childId: string, patch: Partial<TSideTreeChild>) => void
  reload: () => void
  reorderGroups: (groups: readonly TSideTreeGroup[]) => void
}

export type TDocTreeNodeDTO = {
  id: string
  parentId?: string | null
  docId?: string | null
  type: TSideTreeGroup['type'] | TSideTreeChild['type'] | 'GROUP' | 'PAGE' | 'LINK'
  title?: string | null
  slug?: string | null
  index?: number | null
  href?: string | null
  marker?: TSideTreeChild['marker'] | null
  badge?: string | null
  hidden?: boolean | null
  expanded?: boolean | null
  publishState?: TDocTreeNodePublishState | null
  children?: TDocTreeNodeDTO[] | null
}

export type TDocTreeMutationPayload = {
  revision: number
  conflict?: boolean | null
  node?: TDocTreeNodeDTO | null
  affectedNodes?: TDocTreeNodeDTO[] | null
}

export type TDocTreeMutationData = Record<string, TDocTreeMutationPayload | null | undefined>

export type TDocTreeInitialData = {
  revision: number
  groups: TDocTreeNodeDTO[]
}
