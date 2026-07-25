import { SIDE_TREE_NODE_TYPE } from '../constant'
import type {
  TEditingTarget,
  TSideTreeChild,
  TSideTreeGroup,
  TSideTreeNavigationNode,
} from '../spec'
import { duplicateSideTreeChild } from './factory'

const isGroup = (node: TSideTreeGroup['pages'][number]): node is TSideTreeGroup =>
  node.type === SIDE_TREE_NODE_TYPE.GROUP

const mapGroups = (
  groups: readonly TSideTreeGroup[],
  mapper: (group: TSideTreeGroup) => TSideTreeGroup,
): TSideTreeGroup[] =>
  groups.map((group) =>
    mapper({
      ...group,
      pages: group.pages.map((child) => (isGroup(child) ? mapGroups([child], mapper)[0] : child)),
    }),
  )

export const findGroup = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
): TSideTreeGroup | null => {
  for (const group of groups) {
    if (group.id === groupId) return group
    const nested = findGroup(group.pages.filter(isGroup), groupId)
    if (nested) return nested
  }
  return null
}

/**
 * Check whether a node id belongs only to the local optimistic tree.
 *
 * A local id is temporary frontend identity while a backend create mutation is
 * pending. It is unrelated to the backend `draft` stage, whose nodes have real
 * ids and can be deleted into Trash.
 *
 * @example
 * if (isLocalId(child.id)) return
 */
const LOCAL_NODE_TYPES = new Set<string>([
  SIDE_TREE_NODE_TYPE.PIN,
  SIDE_TREE_NODE_TYPE.GROUP,
  SIDE_TREE_NODE_TYPE.PAGE,
  SIDE_TREE_NODE_TYPE.LINK,
])

export const isLocalId = (id: string): boolean => {
  const [scope, type, timestamp, sequence, ...rest] = id.split('-')

  return (
    rest.length === 0 &&
    scope === 'local' &&
    LOCAL_NODE_TYPES.has(type) &&
    /^\d+$/.test(timestamp) &&
    /^\d+$/.test(sequence)
  )
}

/**
 * Remove a local optimistic node when inline editing is explicitly cancelled.
 *
 * @example
 * const nextGroups = removeLocalTarget(groups, editingTarget)
 * if (nextGroups) commitGroups(nextGroups)
 */
export const removeLocalTarget = (
  groups: readonly TSideTreeGroup[],
  target: TEditingTarget,
): TSideTreeGroup[] | null => {
  if (!target) return null

  if (target.type === SIDE_TREE_NODE_TYPE.GROUP && isLocalId(target.groupId)) {
    return mapGroups(groups, (group) => ({
      ...group,
      pages: group.pages.filter((child) => child.id !== target.groupId),
    })).filter((group) => group.id !== target.groupId)
  }

  if ('childId' in target && isLocalId(target.childId)) {
    return mapGroups(groups, (group) =>
      group.id === target.groupId
        ? { ...group, pages: group.pages.filter((child) => child.id !== target.childId) }
        : group,
    )
  }

  return null
}

/**
 * Check whether cancelling or deleting a target removes the active page.
 *
 * @example
 * if (isActiveRemovedByTarget(groups, target, activeId)) selectPage(findFirstPage(groups))
 */
export const isActiveRemovedByTarget = (
  groups: readonly TSideTreeGroup[],
  target: TEditingTarget,
  activeId: string | null,
): boolean => {
  if (!target || !activeId) return false

  if (target.type === SIDE_TREE_NODE_TYPE.PIN) return false

  if ('childId' in target) return activeId === target.childId

  const group = findGroup(groups, target.groupId)
  return group ? findChild([group], activeId) !== null : false
}

/**
 * Replace a local optimistic group with the backend-created draft group.
 *
 * @example
 * const nextGroups = replaceGroupId(groups, localId, remoteGroup)
 */
export const replaceGroupId = (
  groups: readonly TSideTreeGroup[],
  localId: string,
  remote: TSideTreeGroup,
): TSideTreeGroup[] =>
  mapGroups(groups, (group) => ({
    ...group,
    pages: group.pages.map((child) => (child.id === localId ? remote : child)),
  })).map((group) => (group.id === localId ? remote : group))

/**
 * Replace a local optimistic child with the backend-created draft page or link.
 *
 * @example
 * const nextGroups = replaceChildId(groups, groupId, localId, remoteChild)
 */
export const replaceChildId = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  localId: string,
  remote: TSideTreeChild,
): TSideTreeGroup[] =>
  mapGroups(groups, (group) =>
    group.id === groupId
      ? {
          ...group,
          pages: group.pages.map((child) => (child.id === localId ? remote : child)),
        }
      : group,
  )

/**
 * Update one child title without changing group or sibling order.
 *
 * @example
 * const nextGroups = updateChildTitleInGroup(groups, groupId, childId, 'Docs')
 */
export const updateChildTitleInGroup = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  childId: string,
  title: string,
): TSideTreeGroup[] =>
  mapGroups(groups, (group) =>
    group.id === groupId
      ? {
          ...group,
          pages: group.pages.map((child) => (child.id === childId ? { ...child, title } : child)),
        }
      : group,
  )

/**
 * Patch one group while preserving its current pages.
 *
 * @example
 * const nextGroups = patchGroupInGroups(groups, groupId, { title: 'Guides' })
 */
export const patchGroupInGroups = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  patch: Partial<TSideTreeGroup>,
): TSideTreeGroup[] =>
  mapGroups(groups, (group) => (group.id === groupId ? { ...group, ...patch } : group))

/**
 * Insert a local node at the start of its canonical Group or leaf lane.
 *
 * @example
 * const nextGroups = appendChildToGroup(groups, groupId, child)
 */
export const insertLocalNodeInGroup = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  child: TSideTreeNavigationNode,
): TSideTreeGroup[] =>
  mapGroups(groups, (group) =>
    group.id === groupId
      ? {
          ...group,
          expanded: true,
          pages: isGroup(child)
            ? [child, ...group.pages]
            : [
                ...group.pages.filter(isGroup),
                child,
                ...group.pages.filter((page) => !isGroup(page)),
              ],
        }
      : group,
  )

/**
 * Move a confirmed local Page/Link to the end of its leaf lane.
 *
 * The inline input starts at the top of the leaf lane; confirmation is the
 * transition into the persisted order.
 */
export const moveChildToLeafEnd = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  childId: string,
): TSideTreeGroup[] =>
  mapGroups(groups, (group) => {
    if (group.id !== groupId) return group

    const child = group.pages.find((page) => page.id === childId)
    if (!child || isGroup(child)) return group

    return {
      ...group,
      pages: [
        ...group.pages.filter(isGroup),
        ...group.pages.filter((page) => !isGroup(page) && page.id !== childId),
        child,
      ],
    }
  })

/**
 * Move a confirmed local Group to the end of its Group lane.
 *
 * The inline input starts at the top of the Group lane; confirmation is the
 * transition into the persisted order. Page/Link leaves remain below Groups.
 */
export const moveGroupToGroupLaneEnd = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
): TSideTreeGroup[] => {
  const rootGroup = groups.find((group) => group.id === groupId)

  if (rootGroup) {
    return [...groups.filter((group) => group.id !== groupId), rootGroup]
  }

  return mapGroups(groups, (group) => {
    const nestedGroup = group.pages.find((page) => page.id === groupId && isGroup(page))
    if (!nestedGroup || !isGroup(nestedGroup)) return group

    return {
      ...group,
      pages: [
        ...group.pages.filter((page) => isGroup(page) && page.id !== groupId),
        nestedGroup,
        ...group.pages.filter((page) => !isGroup(page)),
      ],
    }
  })
}

/**
 * Remove one group and all of its pages.
 *
 * @example
 * const nextGroups = removeGroupFromGroups(groups, groupId)
 */
export const removeGroupFromGroups = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
): TSideTreeGroup[] =>
  mapGroups(groups, (group) => ({
    ...group,
    pages: group.pages.filter((child) => child.id !== groupId),
  })).filter((group) => group.id !== groupId)

/**
 * Toggle one group in local UI state.
 *
 * @example
 * const { groups: nextGroups } = toggleGroupExpandedInGroups(groups, groupId)
 */
export const toggleGroupExpandedInGroups = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
): { groups: TSideTreeGroup[] } => {
  return {
    groups: mapGroups(groups, (group) =>
      group.id === groupId ? { ...group, expanded: group.expanded === false } : group,
    ),
  }
}

/**
 * Remove one page or link from its parent group.
 *
 * @example
 * const nextGroups = removeChildFromGroup(groups, groupId, childId)
 */
export const removeChildFromGroup = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  childId: string,
): TSideTreeGroup[] =>
  mapGroups(groups, (group) =>
    group.id === groupId
      ? {
          ...group,
          pages: group.pages.filter((child) => child.id !== childId),
        }
      : group,
  )

/**
 * Update the marker style of one page or link.
 *
 * @example
 * const nextGroups = updateChildMarkerInGroup(groups, groupId, childId, marker)
 */
export const updateChildMarkerInGroup = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  childId: string,
  marker: TSideTreeChild['marker'],
): TSideTreeGroup[] =>
  mapGroups(groups, (group) =>
    group.id === groupId
      ? {
          ...group,
          pages: group.pages.map((child) => (child.id === childId ? { ...child, marker } : child)),
        }
      : group,
  )

/**
 * Patch one child by id across all groups.
 *
 * @example
 * const nextGroups = patchChildInGroups(groups, childId, { href: 'https://example.com' })
 */
export const patchChildInGroups = (
  groups: readonly TSideTreeGroup[],
  childId: string,
  patch: Partial<TSideTreeChild>,
): TSideTreeGroup[] =>
  mapGroups(groups, (group) => ({
    ...group,
    pages: group.pages.map((child) =>
      child.id === childId ? ({ ...child, ...patch } as TSideTreeChild) : child,
    ),
  }))

/**
 * Insert a local duplicate immediately after the source child.
 *
 * @example
 * const { groups: nextGroups, duplicatedId } = duplicateChildInGroup(groups, groupId, childId, 'Untitled')
 */
export const duplicateChildInGroup = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  childId: string,
  untitledTitle: string,
): { groups: TSideTreeGroup[]; duplicatedId: string | null } => {
  let duplicatedId: string | null = null
  const nextGroups = mapGroups(groups, (group) => {
    if (group.id !== groupId) return group

    const childIndex = group.pages.findIndex((child) => child.id === childId)
    const child = group.pages[childIndex]
    if (childIndex === -1 || !child || isGroup(child)) return group

    const duplicated = duplicateSideTreeChild(child, untitledTitle)
    duplicatedId = duplicated.id
    const pages = [...group.pages]
    pages.splice(childIndex + 1, 0, duplicated)

    return { ...group, pages }
  })

  return { groups: nextGroups, duplicatedId }
}

/**
 * Find a group's current index for create or reorder payloads.
 *
 * @example
 * const index = findGroupIndex(groups, groupId)
 */
export const findGroupIndex = (groups: readonly TSideTreeGroup[], groupId: string): number =>
  findGroup(groups, groupId)?.parentNodeId
    ? (findGroup(groups, findGroup(groups, groupId)?.parentNodeId || '')?.pages.findIndex(
        (child) => child.id === groupId,
      ) ?? groups.findIndex((group) => group.id === groupId))
    : groups.findIndex((group) => group.id === groupId)

/**
 * Find a child index inside its parent group.
 *
 * @example
 * const index = findChildIndex(groups, groupId, childId)
 */
export const findChildIndex = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  childId: string,
): number => {
  const group = findGroup(groups, groupId)
  if (!group) return -1
  return group.pages.findIndex((child) => child.id === childId)
}

/**
 * Find the first page child that can become the active editor page.
 *
 * @example
 * const fallback = findFirstPage(groups)
 */
export const findFirstPage = (groups: readonly TSideTreeGroup[]): TSideTreeChild | null => {
  for (const group of groups) {
    const child = group.pages.find((item) => item.type === SIDE_TREE_NODE_TYPE.PAGE)
    if (child && !isGroup(child)) return child
    const nested = findFirstPage(group.pages.filter(isGroup))
    if (nested) return nested
  }

  return null
}

/**
 * Find a child by id across all groups.
 *
 * @example
 * const child = findChild(groups, activeId)
 */
export const findChild = (
  groups: readonly TSideTreeGroup[],
  childId: string,
): TSideTreeChild | null => {
  for (const group of groups) {
    const child = group.pages.find((item) => item.id === childId)
    if (child && !isGroup(child)) return child
    const nested = findChild(group.pages.filter(isGroup), childId)
    if (nested) return nested
  }

  return null
}

/**
 * Build an editing target for a child if that child still exists.
 *
 * @example
 * const target = findChildEditingTarget(groups, groupId, childId)
 * if (target) setEditingTarget(target)
 */
export const findChildEditingTarget = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  childId: string,
): TEditingTarget => {
  const group = findGroup(groups, groupId)
  const child = group?.pages.find((item) => item.id === childId)

  return child && !isGroup(child) ? { type: child.type, groupId, childId } : null
}

/**
 * Find the local page child that owns a backend doc id.
 *
 * @example
 * const page = findPageByDocId(groups, currentDocId)
 */
export const findPageByDocId = (
  groups: readonly TSideTreeGroup[],
  docId: string | null,
): TSideTreeChild | null => {
  if (!docId) return null

  for (const group of groups) {
    const child = group.pages.find(
      (item) => item.type === SIDE_TREE_NODE_TYPE.PAGE && item.docId === docId,
    )
    if (child && child.type !== SIDE_TREE_NODE_TYPE.GROUP) return child
    const nested = findPageByDocId(group.pages.filter(isGroup), docId)
    if (nested) return nested
  }

  return null
}

/**
 * Resolve the active side-tree id from the current URL doc id.
 * No doc id means the editor route should stay in its empty workspace state.
 *
 * @example
 * const activeId = resolveActiveIdFromUrl(groups, currentDocId)
 */
export const resolveActiveIdFromUrl = (
  groups: readonly TSideTreeGroup[],
  docId: string | null,
): string | null => {
  if (docId) return findPageByDocId(groups, docId)?.id ?? null

  return null
}

/** Resolves the authoritative parent and index for one explicit DnD active node. */
export const findNodePosition = (
  groups: readonly TSideTreeGroup[],
  nodeId: string,
): { parentNodeId: string | null; index: number } | null => {
  for (const [index, group] of groups.entries()) {
    if (group.id === nodeId) {
      return { parentNodeId: group.parentNodeId || null, index }
    }

    for (const [pageIndex, page] of group.pages.entries()) {
      if (page.id === nodeId) return { parentNodeId: group.id, index: pageIndex }
      if (isGroup(page)) {
        const nested = findNodePosition([page], nodeId)
        if (nested) return nested
      }
    }
  }

  return null
}
