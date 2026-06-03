import { arrayMove } from '@dnd-kit/sortable'

import type { TFaqDragTarget, TFaqEditorGroup, TFaqEditorItem } from './spec'

/**
 * Keeps FAQ columns unchanged for the shared sortable draft controller.
 */
export const flattenFaqGroups = (groups: readonly TFaqEditorGroup[]): readonly TFaqEditorGroup[] =>
  groups

/**
 * Compares the whole FAQ drag draft to decide whether a drop should commit.
 */
export const sameFaqGroups = (
  left: readonly TFaqEditorGroup[],
  right: readonly TFaqEditorGroup[],
): boolean => JSON.stringify(left) === JSON.stringify(right)

/**
 * Finds the group that currently owns an item during item drag.
 */
export const findGroupWithItem = (
  groups: readonly TFaqEditorGroup[],
  itemId: string,
): { column: TFaqEditorGroup; link: TFaqEditorItem } | null => {
  for (const group of groups) {
    const item = group.items.find((entry) => entry.id === itemId)
    if (item) return { column: group, link: item }
  }

  return null
}

/**
 * Moves one FAQ item within a group or across groups in the transient DnD draft.
 */
export const moveFaqItemInGroups = (
  groups: readonly TFaqEditorGroup[],
  itemId: string,
  target: TFaqDragTarget,
): TFaqEditorGroup[] => {
  if (!target.columnId || target.itemId === itemId) return [...groups]

  const source = findGroupWithItem(groups, itemId)
  const targetGroup = groups.find((group) => group.id === target.columnId)

  if (!source || !targetGroup) return [...groups]

  const sourceItems = source.column.items.filter((item) => item.id !== itemId)
  const targetBase =
    source.column.id === targetGroup.id
      ? sourceItems
      : targetGroup.items.filter((item) => item.id !== itemId)

  const targetIndex = target.itemId
    ? targetBase.findIndex((item) => item.id === target.itemId)
    : targetBase.length
  const insertIndex =
    targetIndex >= 0 ? targetIndex + (target.position === 'after' ? 1 : 0) : targetBase.length
  const boundedIndex = Math.max(0, Math.min(insertIndex, targetBase.length))
  const targetItems = [
    ...targetBase.slice(0, boundedIndex),
    source.link,
    ...targetBase.slice(boundedIndex),
  ]

  return groups.map((group) => {
    if (group.id === source.column.id && group.id !== targetGroup.id) {
      return { ...group, items: sourceItems }
    }

    if (group.id === targetGroup.id) {
      return { ...group, items: targetItems }
    }

    return group
  })
}

/**
 * Reorders whole FAQ groups in the transient DnD draft.
 */
export const moveFaqGroup = (
  groups: readonly TFaqEditorGroup[],
  groupId: string,
  targetGroupId: string,
): TFaqEditorGroup[] => {
  if (groupId === targetGroupId) return [...groups]

  const activeIndex = groups.findIndex((group) => group.id === groupId)
  if (activeIndex < 0) return [...groups]

  const targetIndex = groups.findIndex((group) => group.id === targetGroupId)
  if (targetIndex < 0) return [...groups]

  return arrayMove([...groups], activeIndex, targetIndex)
}
