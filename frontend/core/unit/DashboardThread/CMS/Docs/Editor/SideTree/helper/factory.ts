import {
  DEFAULT_LINK_HREF,
  DEFAULT_LINK_MARKER,
  DEFAULT_PAGE_MARKER,
  DEFAULT_PIN_MARKER,
  DEMO_SIDE_TREE_GROUPS,
  DUPLICATE_TITLE_SUFFIX,
  SIDE_TREE_CHILD_MENU_ACTION,
  SIDE_TREE_ID_PREFIX,
  SIDE_TREE_NODE_TYPE,
} from '../constant'
import type {
  TSideTreeChild,
  TSideTreeChildMenuAction,
  TSideTreeGroup,
  TSideTreePin,
} from '../spec'

let nextId = 0

/**
 * Create a local-only id for optimistic SideTree nodes.
 *
 * This id exists only until the backend returns the real id for its draft node;
 * the `local` naming intentionally does not describe backend draft stage.
 *
 * @example
 * const id = makeLocalSideTreeId(SIDE_TREE_ID_PREFIX.PAGE)
 * // id starts with "local-page-"
 */
export const makeLocalSideTreeId = (prefix: string): string => {
  nextId += 1
  return `local-${prefix}-${Date.now()}-${nextId}`
}

/**
 * Clone demo groups before putting them into React state.
 * This keeps interactive edits from mutating the shared demo constant.
 *
 * @example
 * const groups = cloneDemoGroups()
 * groups[0].pages !== DEMO_SIDE_TREE_GROUPS[0].pages
 */
export const cloneDemoGroups = (): TSideTreeGroup[] =>
  DEMO_SIDE_TREE_GROUPS.map((group) => ({
    ...group,
    pages: group.pages.map((child) => ({ ...child })),
  }))

/**
 * Create an empty editable group.
 *
 * @example
 * const group = createSideTreeGroup('Untitled')
 * group.type === SIDE_TREE_NODE_TYPE.GROUP
 */
export const createSideTreeGroup = (untitledTitle: string): TSideTreeGroup => ({
  id: makeLocalSideTreeId(SIDE_TREE_ID_PREFIX.GROUP),
  parentNodeId: '',
  type: SIDE_TREE_NODE_TYPE.GROUP,
  title: untitledTitle,
  expanded: true,
  pages: [],
})

/** Creates side tree pin from typed frontend shared inputs. */
export const createSideTreePin = (untitledTitle: string): TSideTreePin => ({
  id: makeLocalSideTreeId(SIDE_TREE_ID_PREFIX.PIN),
  type: SIDE_TREE_NODE_TYPE.PIN,
  title: untitledTitle,
  href: '',
  marker: DEFAULT_PIN_MARKER,
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
        id: makeLocalSideTreeId(SIDE_TREE_ID_PREFIX.PAGE),
        type: SIDE_TREE_NODE_TYPE.PAGE,
        title: untitledTitle,
        marker: DEFAULT_PAGE_MARKER,
      }
    : {
        id: makeLocalSideTreeId(SIDE_TREE_ID_PREFIX.LINK),
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
        id: makeLocalSideTreeId(SIDE_TREE_ID_PREFIX.PAGE),
        title: `${child.title || untitledTitle} ${DUPLICATE_TITLE_SUFFIX}`,
        docId: undefined,
        path: undefined,
        href: undefined,
      }
    : {
        ...child,
        id: makeLocalSideTreeId(SIDE_TREE_ID_PREFIX.LINK),
        title: `${child.title || untitledTitle} ${DUPLICATE_TITLE_SUFFIX}`,
      }
