import { arrayMove } from '@dnd-kit/sortable'

import type { TSideTreeChild, TSideTreeGroup } from '../spec'
import type { TSideTreeDragTarget } from './spec'

// The persisted shape is already group-first, so flattening for the shared
// draft controller is just returning the groups in their current order.
export const flattenSideTreeGroups = (
  groups: readonly TSideTreeGroup[],
): readonly TSideTreeGroup[] => groups

// The SideTree editor is local-state only for now; deep JSON comparison is
// enough to decide whether a drag draft actually changed the tree.
export const sameSideTreeGroups = (
  left: readonly TSideTreeGroup[],
  right: readonly TSideTreeGroup[],
): boolean => JSON.stringify(left) === JSON.stringify(right)

// Adapter for the shared link-dnd controller: a SideTree child is the "link",
// and its parent SideTree group is the "column".
export const findGroupWithChild = (
  groups: readonly TSideTreeGroup[],
  childId: string,
): { column: TSideTreeGroup; link: TSideTreeChild } | null => {
  for (const group of groups) {
    const child = group.children.find((item) => item.id === childId)
    if (child) return { column: group, link: child }
  }

  return null
}

// Move a page/link inside one group or across groups. `target.itemId` positions
// the child before/after a sibling; a missing item id means append to the group.
export const moveSideTreeChildInGroups = (
  groups: readonly TSideTreeGroup[],
  childId: string,
  target: TSideTreeDragTarget,
): TSideTreeGroup[] => {
  if (!target.columnId || target.itemId === childId) return [...groups]

  const source = findGroupWithChild(groups, childId)
  const targetGroup = groups.find((group) => group.id === target.columnId)

  if (!source || !targetGroup) return [...groups]

  const sourceChildren = source.column.children.filter((child) => child.id !== childId)
  const targetBase =
    source.column.id === targetGroup.id
      ? sourceChildren
      : targetGroup.children.filter((child) => child.id !== childId)

  const targetIndex = target.itemId
    ? targetBase.findIndex((child) => child.id === target.itemId)
    : targetBase.length
  const insertIndex =
    targetIndex >= 0 ? targetIndex + (target.position === 'after' ? 1 : 0) : targetBase.length
  const boundedIndex = Math.max(0, Math.min(insertIndex, targetBase.length))
  const targetChildren = [
    ...targetBase.slice(0, boundedIndex),
    source.link,
    ...targetBase.slice(boundedIndex),
  ]

  return groups.map((group) => {
    if (group.id === source.column.id && group.id !== targetGroup.id) {
      return { ...group, children: sourceChildren }
    }

    if (group.id === targetGroup.id) {
      return { ...group, children: targetChildren }
    }

    return group
  })
}

// Reorder whole groups without changing any group's children.
export const moveSideTreeGroup = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
  targetGroupId: string,
): TSideTreeGroup[] => {
  if (groupId === targetGroupId) return [...groups]

  const activeIndex = groups.findIndex((group) => group.id === groupId)
  if (activeIndex < 0) return [...groups]

  const targetIndex = groups.findIndex((group) => group.id === targetGroupId)
  if (targetIndex < 0) return [...groups]

  return arrayMove([...groups], activeIndex, targetIndex)
}
