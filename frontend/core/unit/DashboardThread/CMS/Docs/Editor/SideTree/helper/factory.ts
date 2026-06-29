import {
  DEFAULT_LINK_HREF,
  DEFAULT_LINK_MARKER,
  DEFAULT_PAGE_MARKER,
  DEMO_SIDE_TREE_GROUPS,
  DUPLICATE_TITLE_SUFFIX,
  SIDE_TREE_CHILD_MENU_ACTION,
  SIDE_TREE_ID_PREFIX,
  SIDE_TREE_NODE_TYPE,
} from '../constant'
import type { TSideTreeChild, TSideTreeChildMenuAction, TSideTreeGroup } from '../spec'

let nextId = 0

/**
 * Create a local-only id for optimistic SideTree nodes.
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
 * const group = createSideTreeGroup('Untitled')
 * group.type === SIDE_TREE_NODE_TYPE.GROUP
 */
export const createSideTreeGroup = (untitledTitle: string): TSideTreeGroup => ({
  id: makeSideTreeId(SIDE_TREE_ID_PREFIX.GROUP),
  type: SIDE_TREE_NODE_TYPE.GROUP,
  title: untitledTitle,
  expanded: true,
  children: [],
})

/**
 * Create a page or quick-link child from the add-child menu action.
 *
 * @example
 * const page = createSideTreeChild(SIDE_TREE_CHILD_MENU_ACTION.PAGE, 'Untitled')
 * page.type === SIDE_TREE_NODE_TYPE.PAGE
 */
export const createSideTreeChild = (
  action: TSideTreeChildMenuAction,
  untitledTitle: string,
): TSideTreeChild =>
  action === SIDE_TREE_CHILD_MENU_ACTION.PAGE
    ? {
        id: makeSideTreeId(SIDE_TREE_ID_PREFIX.PAGE),
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: untitledTitle,
        marker: DEFAULT_PAGE_MARKER,
      }
    : {
        id: makeSideTreeId(SIDE_TREE_ID_PREFIX.LINK),
        type: SIDE_TREE_NODE_TYPE.LINK,
        title: untitledTitle,
        href: DEFAULT_LINK_HREF,
        marker: DEFAULT_LINK_MARKER,
      }

/**
 * Duplicate a child beside the original while clearing backend identity fields.
 *
 * @example
 * const duplicated = duplicateSideTreeChild(page, 'Untitled')
 * duplicated.id !== page.id
 */
export const duplicateSideTreeChild = (
  child: TSideTreeChild,
  untitledTitle: string,
): TSideTreeChild =>
  child.type === SIDE_TREE_NODE_TYPE.PAGE
    ? {
        ...child,
        id: makeSideTreeId(SIDE_TREE_ID_PREFIX.PAGE),
        title: `${child.title || untitledTitle} ${DUPLICATE_TITLE_SUFFIX}`,
        workspaceId: undefined,
        path: undefined,
        href: undefined,
      }
    : {
        ...child,
        id: makeSideTreeId(SIDE_TREE_ID_PREFIX.LINK),
        title: `${child.title || untitledTitle} ${DUPLICATE_TITLE_SUFFIX}`,
      }
