import { SIDE_TREE_NODE_TYPE } from '../constant'
import type { TEditingTarget, TSideTreeChild, TSideTreeGroup } from '../spec'
import { duplicateSideTreeChild } from './factory'

/**
 * Check whether a node id belongs to a local optimistic draft.
 *
 * @example
 * if (isDraftId(child.id)) return
 */
export const isDraftId = (id: string): boolean =>
  id.startsWith(`${SIDE_TREE_NODE_TYPE.GROUP}-`) ||
  id.startsWith(`${SIDE_TREE_NODE_TYPE.PAGE}-`) ||
  id.startsWith(`${SIDE_TREE_NODE_TYPE.LINK}-`)

/**
 * Remove an unsaved draft node when inline editing is cancelled.
 *
 * @example
 * const nextGroups = removeDraftTarget(groups, editingTarget)
 * if (nextGroups) commitGroups(nextGroups)
 */
export const removeDraftTarget = (
  groups: readonly TSideTreeGroup[],
  target: TEditingTarget,
): TSideTreeGroup[] | null => {
  if (!target) return null

  if (target.type === SIDE_TREE_NODE_TYPE.GROUP && isDraftId(target.groupId)) {
    return groups.filter((group) => group.id !== target.groupId)
  }

  if ('childId' in target && isDraftId(target.childId)) {
    return groups.map((group) =>
      group.id === target.groupId
        ? { ...group, children: group.children.filter((child) => child.id !== target.childId) }
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

  if ('childId' in target) return activeId === target.childId

  const group = groups.find((item) => item.id === target.groupId)
  return group?.children.some((child) => child.id === activeId) ?? false
}

/**
 * Replace a local draft group with the backend-created group.
 *
 * @example
 * const nextGroups = replaceGroupId(groups, draftId, remoteGroup)
 */
export const replaceGroupId = (
  groups: readonly TSideTreeGroup[],
  localId: string,
  remote: TSideTreeGroup,
): TSideTreeGroup[] => groups.map((group) => (group.id === localId ? remote : group))

/**
 * Replace a local draft child with the backend-created page or link.
 *
 * @example
 * const nextGroups = replaceChildId(groups, groupId, draftId, remoteChild)
 */
export const replaceChildId = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  localId: string,
  remote: TSideTreeChild,
): TSideTreeGroup[] =>
  groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          children: group.children.map((child) => (child.id === localId ? remote : child)),
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
  groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          children: group.children.map((child) =>
            child.id === childId ? { ...child, title } : child,
          ),
        }
      : group,
  )

/**
 * Patch one group while preserving its current children.
 *
 * @example
 * const nextGroups = patchGroupInGroups(groups, groupId, { title: 'Guides' })
 */
export const patchGroupInGroups = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  patch: Partial<TSideTreeGroup>,
): TSideTreeGroup[] =>
  groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group))

/**
 * Append a new child to a group and expand that group.
 *
 * @example
 * const nextGroups = appendChildToGroup(groups, groupId, child)
 */
export const appendChildToGroup = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  child: TSideTreeChild,
): TSideTreeGroup[] =>
  groups.map((group) =>
    group.id === groupId
      ? { ...group, expanded: true, children: [...group.children, child] }
      : group,
  )

/**
 * Remove one group and all of its children.
 *
 * @example
 * const nextGroups = removeGroupFromGroups(groups, groupId)
 */
export const removeGroupFromGroups = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
): TSideTreeGroup[] => groups.filter((group) => group.id !== groupId)

/**
 * Toggle one group and return the next expanded value for persistence.
 *
 * @example
 * const { groups: nextGroups, expanded } = toggleGroupExpandedInGroups(groups, groupId)
 */
export const toggleGroupExpandedInGroups = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
): { groups: TSideTreeGroup[]; expanded: boolean } => {
  const group = groups.find((item) => item.id === groupId)
  const expanded = group?.expanded === false

  return {
    groups: groups.map((group) =>
      group.id === groupId ? { ...group, expanded: group.expanded === false } : group,
    ),
    expanded,
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
  groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          children: group.children.filter((child) => child.id !== childId),
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
  groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          children: group.children.map((child) =>
            child.id === childId ? { ...child, marker } : child,
          ),
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
  groups.map((group) => ({
    ...group,
    children: group.children.map((child) =>
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
  const nextGroups = groups.map((group) => {
    if (group.id !== groupId) return group

    const childIndex = group.children.findIndex((child) => child.id === childId)
    const child = group.children[childIndex]
    if (childIndex === -1 || !child) return group

    const duplicated = duplicateSideTreeChild(child, untitledTitle)
    duplicatedId = duplicated.id
    const children = [...group.children]
    children.splice(childIndex + 1, 0, duplicated)

    return { ...group, children }
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
  groups.findIndex((group) => group.id === groupId)

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
  const group = groups.find((item) => item.id === groupId)
  if (!group) return -1
  return group.children.findIndex((child) => child.id === childId)
}

/**
 * Find the first page child that can become the active editor page.
 *
 * @example
 * const fallback = findFirstPage(groups)
 */
export const findFirstPage = (groups: readonly TSideTreeGroup[]): TSideTreeChild | null => {
  for (const group of groups) {
    const child = group.children.find((item) => item.type === SIDE_TREE_NODE_TYPE.PAGE)
    if (child) return child
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
    const child = group.children.find((item) => item.id === childId)
    if (child) return child
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
  const group = groups.find((item) => item.id === groupId)
  const child = group?.children.find((item) => item.id === childId)

  return child ? { type: child.type, groupId, childId } : null
}

/**
 * Find the local page child that owns a backend doc draft id.
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
    const child = group.children.find(
      (item) => item.type === SIDE_TREE_NODE_TYPE.PAGE && item.docId === docId,
    )
    if (child) return child
  }

  return null
}

/**
 * Resolve the active side-tree id from the current URL doc id.
 *
 * @example
 * const activeId = resolveActiveIdFromUrl(groups, currentDocId)
 */
export const resolveActiveIdFromUrl = (
  groups: readonly TSideTreeGroup[],
  docId: string | null,
): string | null => {
  if (docId) return findPageByDocId(groups, docId)?.id ?? null

  return findFirstPage(groups)?.id ?? null
}

/**
 * Detect the moved node and target position between two ordered trees.
 *
 * @example
 * const moved = findMovedNode(previousGroups, nextGroups)
 * if (moved) persistMove(moved)
 */
export const findMovedNode = (
  prevGroups: readonly TSideTreeGroup[],
  nextGroups: readonly TSideTreeGroup[],
): { id: string; targetParentId: string | null; targetIndex: number } | null => {
  const prevPositions = new Map<string, { parentId: string | null; index: number }>()

  for (const [index, group] of prevGroups.entries()) {
    prevPositions.set(group.id, { parentId: null, index })
    for (const [childIndex, child] of group.children.entries()) {
      prevPositions.set(child.id, { parentId: group.id, index: childIndex })
    }
  }

  for (const [index, group] of nextGroups.entries()) {
    const prev = prevPositions.get(group.id)
    if (prev && (prev.parentId !== null || prev.index !== index)) {
      return { id: group.id, targetParentId: null, targetIndex: index }
    }

    for (const [childIndex, child] of group.children.entries()) {
      const prevChild = prevPositions.get(child.id)
      if (prevChild && (prevChild.parentId !== group.id || prevChild.index !== childIndex)) {
        return { id: child.id, targetParentId: group.id, targetIndex: childIndex }
      }
    }
  }

  return null
}
