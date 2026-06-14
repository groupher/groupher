import type { TNodeStyleValue } from '~/spec'

import type {
  SIDE_TREE_CHILD_MENU_ACTION,
  SIDE_TREE_GROUP_MENU_ACTION,
  SIDE_TREE_NODE_MENU_ACTION,
  SIDE_TREE_NODE_TYPE,
} from './constant'

export type TSideTreeNodeType = (typeof SIDE_TREE_NODE_TYPE)[keyof typeof SIDE_TREE_NODE_TYPE]

export type TSideTreeChildType = typeof SIDE_TREE_NODE_TYPE.PAGE | typeof SIDE_TREE_NODE_TYPE.LINK

export type TSideTreeGroup = {
  id: string
  type: typeof SIDE_TREE_NODE_TYPE.GROUP
  title: string
  slug?: string
  icon?: TNodeStyleValue
  hidden?: boolean
  expanded?: boolean
  children: readonly TSideTreeChild[]
}

export type TSideTreePage = {
  id: string
  type: typeof SIDE_TREE_NODE_TYPE.PAGE
  title?: string
  slug?: string
  docId?: string
  path?: string
  href?: string
  icon?: TNodeStyleValue
  badge?: string
  hidden?: boolean
}

export type TSideTreeLink = {
  id: string
  type: typeof SIDE_TREE_NODE_TYPE.LINK
  title: string
  slug?: string
  href: string
  icon?: TNodeStyleValue
  badge?: string
  hidden?: boolean
}

export type TSideTreeChild = TSideTreePage | TSideTreeLink

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
