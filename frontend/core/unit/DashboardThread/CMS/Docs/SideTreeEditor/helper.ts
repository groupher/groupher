import {
  DEFAULT_LINK_HREF,
  DEFAULT_LINK_STYLE,
  DEFAULT_PAGE_STYLE,
  DEMO_SIDE_TREE_GROUPS,
  DUPLICATE_TITLE_SUFFIX,
  SIDE_TREE_CHILD_MENU_ACTION,
  SIDE_TREE_ID_PREFIX,
  SIDE_TREE_NODE_TYPE,
  UNTITLED_TITLE,
} from './constant'
import type { TSideTreeChild, TSideTreeChildMenuAction, TSideTreeGroup } from './spec'

let nextId = 0

/**
 * Create a local-only id for optimistic SideTreeEditor nodes.
 *
 * @example
 * const id = makeSideTreeId(SIDE_TREE_ID_PREFIX.PAGE)
 * // id starts with "page-"
 */
export const makeSideTreeId = (prefix: string): string => {
  nextId += 1
  return `${prefix}-${Date.now()}-${nextId}`
}

/**
 * Clone demo groups before putting them into React state.
 * This keeps interactive edits from mutating the shared demo constant.
 *
 * @example
 * const groups = cloneDemoGroups()
 * groups[0].children !== DEMO_SIDE_TREE_GROUPS[0].children
 */
export const cloneDemoGroups = (): TSideTreeGroup[] =>
  DEMO_SIDE_TREE_GROUPS.map((group) => ({
    ...group,
    children: group.children.map((child) => ({ ...child })),
  }))

/**
 * Create an empty editable group.
 *
 * @example
 * const group = createSideTreeGroup()
 * group.type === SIDE_TREE_NODE_TYPE.GROUP
 */
export const createSideTreeGroup = (): TSideTreeGroup => ({
  id: makeSideTreeId(SIDE_TREE_ID_PREFIX.GROUP),
  type: SIDE_TREE_NODE_TYPE.GROUP,
  title: UNTITLED_TITLE,
  expanded: true,
  children: [],
})

/**
 * Create a page or quick-link child from the add-child menu action.
 *
 * @example
 * const page = createSideTreeChild(SIDE_TREE_CHILD_MENU_ACTION.PAGE)
 * page.type === SIDE_TREE_NODE_TYPE.PAGE
 */
export const createSideTreeChild = (action: TSideTreeChildMenuAction): TSideTreeChild =>
  action === SIDE_TREE_CHILD_MENU_ACTION.PAGE
    ? {
        id: makeSideTreeId(SIDE_TREE_ID_PREFIX.PAGE),
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: UNTITLED_TITLE,
        icon: DEFAULT_PAGE_STYLE,
      }
    : {
        id: makeSideTreeId(SIDE_TREE_ID_PREFIX.LINK),
        type: SIDE_TREE_NODE_TYPE.LINK,
        title: UNTITLED_TITLE,
        href: DEFAULT_LINK_HREF,
        icon: DEFAULT_LINK_STYLE,
      }

/**
 * Duplicate a child beside the original while clearing backend identity fields.
 *
 * @example
 * const duplicated = duplicateSideTreeChild(page)
 * duplicated.id !== page.id
 */
export const duplicateSideTreeChild = (child: TSideTreeChild): TSideTreeChild =>
  child.type === SIDE_TREE_NODE_TYPE.PAGE
    ? {
        ...child,
        id: makeSideTreeId(SIDE_TREE_ID_PREFIX.PAGE),
        title: `${child.title || UNTITLED_TITLE} ${DUPLICATE_TITLE_SUFFIX}`,
        docId: undefined,
      }
    : {
        ...child,
        id: makeSideTreeId(SIDE_TREE_ID_PREFIX.LINK),
        title: `${child.title || UNTITLED_TITLE} ${DUPLICATE_TITLE_SUFFIX}`,
      }
