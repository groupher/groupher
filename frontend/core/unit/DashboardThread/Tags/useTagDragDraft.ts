import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { sortByIndex } from '~/helper'
import type { TTagGroup, TThread } from '~/spec'

import type { TDraftGroup, TGroupDragTarget, TGroupListItem, TTagDragTarget } from './types'

type TProps = {
  tagGroups: readonly TTagGroup[]
  draftGroups: readonly TDraftGroup[]
  currentThread: TThread
  onCommit: (tagGroups: TTagGroup[]) => void
}

type TRet = {
  groups: TGroupListItem[]
  groupNames: string[]
  startDrag: (id: string) => void
  moveTagDrag: (target?: TTagDragTarget | null) => void
  commitTagDrag: (target?: TTagDragTarget | null) => void
  commitGroupDrag: (target?: TGroupDragTarget | null) => void
  cancelDrag: () => void
}

// Draft groups are UI-only placeholders for newly typed group names. They are
// shown before real groups so users can drag existing tags into them after the
// group is confirmed, but draft groups themselves are never persisted.
const draftGroupId = (draftId: string): string => `draft:${draftId}`

// Builds the editor view model by merging persisted tag groups with local draft
// groups for the selected thread. Persisted groups keep their saved index order;
// draft groups get negative indexes so they remain visually separated from
// server-backed data.
const buildGroups = (
  tagGroups: readonly TTagGroup[],
  draftGroups: readonly TDraftGroup[],
  currentThread: TThread,
): TGroupListItem[] => {
  const realItems = (sortByIndex([...tagGroups]) as TTagGroup[]).map((group) => ({
    id: group.id,
    title: group.title,
    index: group.index,
    tags: sortByIndex([...group.tags]),
    draft: false,
  }))

  const draftItems = draftGroups
    .filter((group) => group.thread === currentThread)
    .map((group, index) => ({
      id: draftGroupId(group.id),
      title: group.title,
      index: -1 - index,
      tags: [],
      draft: true,
      draftId: group.id,
    }))

  return [...draftItems, ...realItems]
}

const normalizeGroupIndexes = (groups: TGroupListItem[]): TGroupListItem[] =>
  groups.map((group, index) => ({ ...group, index }))

// Reorders real groups in the local drag draft. Draft groups are blocked here
// because they do not yet exist in the backend and cannot be committed as part
// of group ordering.
const moveGroup = (
  groups: TGroupListItem[],
  activeId: string,
  target: TGroupDragTarget,
): TGroupListItem[] => {
  if (activeId === target.groupId || activeId.startsWith('draft:')) return groups

  const activeIndex = groups.findIndex((group) => group.id === activeId)

  if (activeIndex < 0 || !groups.some((group) => group.id === target.groupId)) return groups

  const movingGroup = groups[activeIndex]
  const withoutMoving = groups.filter((group) => group.id !== activeId)
  const baseTargetIndex = withoutMoving.findIndex((group) => group.id === target.groupId)
  const insertIndex = baseTargetIndex + (target.position === 'after' ? 1 : 0)
  const boundedIndex = Math.max(0, Math.min(insertIndex, withoutMoving.length))

  return normalizeGroupIndexes([
    ...withoutMoving.slice(0, boundedIndex),
    movingGroup,
    ...withoutMoving.slice(boundedIndex),
  ])
}

// Moves a tag between real groups or within the same group. Dropping into draft
// groups is intentionally blocked: a draft group needs to be saved first so the
// backend can assign a real group id.
const moveTagInGroups = (
  groups: TGroupListItem[],
  tagId: string,
  target: TTagDragTarget,
): TGroupListItem[] => {
  const sourceGroup = groups.find((group) => group.tags.some((tag) => tag.id === tagId))
  const targetGroup = groups.find((group) => group.id === target.groupId)

  if (!sourceGroup || !targetGroup || targetGroup.draft || target.tagId === tagId) return groups

  const movingTag = sourceGroup.tags.find((tag) => tag.id === tagId)
  if (!movingTag) return groups

  const sourceTags = sourceGroup.tags.filter((tag) => tag.id !== tagId)
  const targetBase =
    sourceGroup.id === targetGroup.id
      ? sourceTags
      : targetGroup.tags.filter((tag) => tag.id !== tagId)

  const targetTagIndex = target.tagId
    ? targetBase.findIndex((tag) => tag.id === target.tagId)
    : targetBase.length
  const targetIndex =
    targetTagIndex >= 0 ? targetTagIndex + (target.position === 'after' ? 1 : 0) : targetBase.length
  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, targetBase.length))
  const movedTag = { ...movingTag, groupId: targetGroup.id }
  const targetTags = [
    ...targetBase.slice(0, boundedTargetIndex),
    movedTag,
    ...targetBase.slice(boundedTargetIndex),
  ]

  return groups.map((group) => {
    if (group.id === sourceGroup.id && group.id !== targetGroup.id) {
      return {
        ...group,
        tags: sourceTags.map((tag, index) => ({ ...tag, index })),
      }
    }

    if (group.id === targetGroup.id) {
      return {
        ...group,
        tags: targetTags.map((tag, index) => ({ ...tag, index })),
      }
    }

    return group
  })
}

// Converts the drag draft back to the backend-facing tag group shape. Draft
// groups are filtered out and both group/tag indexes are normalized from the
// current visual order.
const flattenGroups = (groups: readonly TGroupListItem[]): TTagGroup[] => {
  return groups
    .filter((group) => !group.draft)
    .map((group, index) => ({
      id: group.id,
      title: group.title,
      index,
      tags: group.tags.map((tag, tagIndex) => ({
        ...tag,
        groupId: group.id,
        index: tagIndex,
      })),
    }))
}

// Placement comparison ignores UI-only draft groups and compares only the
// persisted group/tag identity and indexes. This prevents unnecessary commits
// when hover updates do not change the final saved order.
const isSamePlacement = (
  left: readonly TGroupListItem[],
  right: readonly TGroupListItem[],
): boolean => {
  const leftGroups = flattenGroups(left)
  const rightGroups = flattenGroups(right)

  if (leftGroups.length !== rightGroups.length) return false

  return leftGroups.every((group, groupIndex) => {
    const otherGroup = rightGroups[groupIndex]
    if (!otherGroup || group.id !== otherGroup.id || group.index !== otherGroup.index) return false
    if (group.tags.length !== otherGroup.tags.length) return false

    return group.tags.every((tag, tagIndex) => {
      const otherTag = otherGroup.tags[tagIndex]
      return (
        tag.id === otherTag?.id && tag.groupId === otherTag.groupId && tag.index === otherTag.index
      )
    })
  })
}

// Keeps a local copy of the tag/group placement while dragging. This mirrors the
// link editor DnD pattern: update local UI during hover, then commit the final
// flattened tagGroups once on drop.
export default function useTagDragDraft({
  tagGroups,
  draftGroups,
  currentThread,
  onCommit,
}: TProps): TRet {
  const sourceGroups = useMemo(
    () => buildGroups(tagGroups, draftGroups, currentThread),
    [currentThread, draftGroups, tagGroups],
  )
  const [groups, setGroups] = useState<TGroupListItem[]>(sourceGroups)
  const latestGroupsRef = useRef(groups)
  const baselineGroupsRef = useRef(groups)
  const activeIdRef = useRef<string | null>(null)
  const draggingRef = useRef(false)
  const commitFrameRef = useRef<number | null>(null)

  useEffect(() => {
    latestGroupsRef.current = groups
  }, [groups])

  useEffect(() => {
    if (draggingRef.current) return
    baselineGroupsRef.current = sourceGroups
    setGroups(sourceGroups)
  }, [sourceGroups])

  useEffect(() => {
    return () => {
      if (commitFrameRef.current) cancelAnimationFrame(commitFrameRef.current)
    }
  }, [])

  const groupNameKey = groups.map((group) => group.title).join('\n')
  const groupNames = useMemo(
    () => groups.map((group) => group.title).filter(Boolean),
    [groupNameKey],
  )

  const startDrag = useCallback((id: string): void => {
    activeIdRef.current = id
    draggingRef.current = true
    baselineGroupsRef.current = latestGroupsRef.current
  }, [])

  const moveTagDrag = useCallback((target?: TTagDragTarget | null): void => {
    const activeId = activeIdRef.current
    if (!activeId || !target?.groupId) return

    const currentGroups = latestGroupsRef.current
    const sourceGroup = currentGroups.find((group) => group.tags.some((tag) => tag.id === activeId))

    if (!sourceGroup || sourceGroup.id === target.groupId) return

    const nextGroups = moveTagInGroups(currentGroups, activeId, target)
    if (nextGroups === currentGroups || isSamePlacement(currentGroups, nextGroups)) return

    latestGroupsRef.current = nextGroups
    setGroups(nextGroups)
  }, [])

  // Commit is delayed to the next animation frame so the final local drag state
  // can paint before the parent dashboard store updates and re-renders.
  const commitDraft = useCallback(
    (nextGroups: TGroupListItem[]): void => {
      if (!isSamePlacement(baselineGroupsRef.current, nextGroups)) {
        if (commitFrameRef.current) cancelAnimationFrame(commitFrameRef.current)
        commitFrameRef.current = requestAnimationFrame(() => {
          onCommit(flattenGroups(nextGroups))
          commitFrameRef.current = null
        })
      }
    },
    [onCommit],
  )

  const commitTagDrag = useCallback(
    (target?: TTagDragTarget | null): void => {
      const activeId = activeIdRef.current
      const currentGroups = latestGroupsRef.current
      const nextGroups =
        activeId && target ? moveTagInGroups(currentGroups, activeId, target) : currentGroups

      activeIdRef.current = null
      draggingRef.current = false

      if (!isSamePlacement(currentGroups, nextGroups)) {
        latestGroupsRef.current = nextGroups
        setGroups(nextGroups)
      }

      commitDraft(nextGroups)
    },
    [commitDraft],
  )

  const commitGroupDrag = useCallback(
    (target?: TGroupDragTarget | null): void => {
      const activeId = activeIdRef.current
      const currentGroups = latestGroupsRef.current
      const nextGroups =
        activeId && target ? moveGroup(currentGroups, activeId, target) : currentGroups

      activeIdRef.current = null
      draggingRef.current = false

      if (!isSamePlacement(currentGroups, nextGroups)) {
        latestGroupsRef.current = nextGroups
        setGroups(nextGroups)
      }

      commitDraft(nextGroups)
    },
    [commitDraft],
  )

  const cancelDrag = useCallback((): void => {
    activeIdRef.current = null
    draggingRef.current = false
    latestGroupsRef.current = baselineGroupsRef.current
    setGroups(baselineGroupsRef.current)
  }, [])

  return {
    groups,
    groupNames,
    startDrag,
    moveTagDrag,
    commitTagDrag,
    commitGroupDrag,
    cancelDrag,
  }
}
