import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { sortByIndex } from '~/helper'
import type { TTag, TTagGroup, TThread } from '~/spec'

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

const buildTagGroupIdMap = (groups: readonly TGroupListItem[]): Map<string, string> => {
  const tagGroupIdMap = new Map<string, string>()

  for (const group of groups) {
    for (const tag of group.tags) {
      tagGroupIdMap.set(tag.id, group.id)
    }
  }

  return tagGroupIdMap
}

const normalizeTagIndexes = (tags: readonly TTag[]): TTag[] =>
  tags.map((tag, index) => (tag.index === index ? tag : { ...tag, index }))

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
  sourceGroupId: string,
): TGroupListItem[] => {
  let sourceGroupIndex = -1
  let targetGroupIndex = -1

  for (let index = 0; index < groups.length; index += 1) {
    const groupId = groups[index].id
    if (sourceGroupIndex < 0 && groupId === sourceGroupId) sourceGroupIndex = index
    if (targetGroupIndex < 0 && groupId === target.groupId) targetGroupIndex = index
    if (sourceGroupIndex >= 0 && targetGroupIndex >= 0) break
  }

  const sourceGroup = groups[sourceGroupIndex]
  const targetGroup = groups[targetGroupIndex]

  if (!sourceGroup || !targetGroup || targetGroup.draft || target.tagId === tagId) return groups

  const sourceTagIndex = sourceGroup.tags.findIndex((tag) => tag.id === tagId)
  if (sourceTagIndex < 0) return groups

  const movingTag = sourceGroup.tags[sourceTagIndex]

  if (sourceGroupIndex === targetGroupIndex) {
    const sourceTagCountAfterRemoval = sourceGroup.tags.length - 1
    const targetTagIndex = target.tagId
      ? sourceGroup.tags.findIndex((tag) => tag.id === target.tagId)
      : sourceGroup.tags.length
    const targetIndexAfterRemoval =
      targetTagIndex >= 0
        ? targetTagIndex - (sourceTagIndex < targetTagIndex ? 1 : 0)
        : sourceTagCountAfterRemoval
    const insertIndex = targetIndexAfterRemoval + (target.position === 'after' ? 1 : 0)
    const boundedTargetIndex = Math.max(0, Math.min(insertIndex, sourceTagCountAfterRemoval))

    // Return before allocating arrays so an adjacent hover remains a true no-op.
    if (boundedTargetIndex === sourceTagIndex) return groups

    const sourceTags = [
      ...sourceGroup.tags.slice(0, sourceTagIndex),
      ...sourceGroup.tags.slice(sourceTagIndex + 1),
    ]
    const movedTag = {
      ...movingTag,
      groupId: targetGroup.id,
      index: boundedTargetIndex,
    }
    const targetTags = [
      ...sourceTags.slice(0, boundedTargetIndex),
      movedTag,
      ...sourceTags.slice(boundedTargetIndex),
    ]
    const nextGroups = [...groups]
    nextGroups[sourceGroupIndex] = {
      ...sourceGroup,
      tags: normalizeTagIndexes(targetTags),
    }

    return nextGroups
  }

  const sourceTags = [
    ...sourceGroup.tags.slice(0, sourceTagIndex),
    ...sourceGroup.tags.slice(sourceTagIndex + 1),
  ]
  const targetBase = targetGroup.tags.filter((tag) => tag.id !== tagId)

  const targetTagIndex = target.tagId
    ? targetBase.findIndex((tag) => tag.id === target.tagId)
    : targetBase.length
  const targetIndex =
    targetTagIndex >= 0 ? targetTagIndex + (target.position === 'after' ? 1 : 0) : targetBase.length
  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, targetBase.length))
  const movedTag = {
    ...movingTag,
    groupId: targetGroup.id,
    index: boundedTargetIndex,
  }
  const targetTags = [
    ...targetBase.slice(0, boundedTargetIndex),
    movedTag,
    ...targetBase.slice(boundedTargetIndex),
  ]
  const nextGroups = [...groups]
  nextGroups[sourceGroupIndex] = {
    ...sourceGroup,
    tags: normalizeTagIndexes(sourceTags),
  }
  nextGroups[targetGroupIndex] = {
    ...targetGroup,
    tags: normalizeTagIndexes(targetTags),
  }

  return nextGroups
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

// Placement comparison ignores UI-only draft groups and walks the persisted
// order directly, avoiding the two fully flattened trees previously allocated
// before a commit.
const isSamePlacement = (
  left: readonly TGroupListItem[],
  right: readonly TGroupListItem[],
): boolean => {
  let leftIndex = 0
  let rightIndex = 0

  while (leftIndex < left.length || rightIndex < right.length) {
    while (left[leftIndex]?.draft) leftIndex += 1
    while (right[rightIndex]?.draft) rightIndex += 1

    const leftGroup = left[leftIndex]
    const rightGroup = right[rightIndex]

    if (!leftGroup || !rightGroup) return !leftGroup && !rightGroup
    if (leftGroup.id !== rightGroup.id || leftGroup.tags.length !== rightGroup.tags.length) {
      return false
    }

    for (let tagIndex = 0; tagIndex < leftGroup.tags.length; tagIndex += 1) {
      if (leftGroup.tags[tagIndex].id !== rightGroup.tags[tagIndex].id) return false
    }

    leftIndex += 1
    rightIndex += 1
  }

  return true
}

// Keeps a local copy of the tag/group placement while dragging. This mirrors the
// link editor DnD pattern: update local UI during hover, then commit the final
// flattened tagGroups once on drop.
/** Exposes tag drag draft state and actions through the shared React hook boundary. */
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
  const tagGroupIdRef = useRef<Map<string, string> | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const draggingRef = useRef(false)
  const commitFrameRef = useRef<number | null>(null)

  if (tagGroupIdRef.current === null) tagGroupIdRef.current = buildTagGroupIdMap(groups)

  useEffect(() => {
    if (draggingRef.current) return
    baselineGroupsRef.current = sourceGroups
    latestGroupsRef.current = sourceGroups
    tagGroupIdRef.current = buildTagGroupIdMap(sourceGroups)
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
    const sourceGroupId = tagGroupIdRef.current?.get(activeId)

    if (!sourceGroupId) return

    const nextGroups = moveTagInGroups(currentGroups, activeId, target, sourceGroupId)
    if (nextGroups === currentGroups) return

    latestGroupsRef.current = nextGroups
    if (sourceGroupId !== target.groupId) tagGroupIdRef.current?.set(activeId, target.groupId)
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
      const sourceGroupId = activeId ? tagGroupIdRef.current?.get(activeId) : undefined
      const nextGroups =
        activeId && target && sourceGroupId
          ? moveTagInGroups(currentGroups, activeId, target, sourceGroupId)
          : currentGroups

      activeIdRef.current = null
      draggingRef.current = false

      if (nextGroups !== currentGroups) {
        latestGroupsRef.current = nextGroups
        if (activeId && target?.groupId && sourceGroupId !== target.groupId) {
          tagGroupIdRef.current?.set(activeId, target.groupId)
        }
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
    tagGroupIdRef.current = buildTagGroupIdMap(baselineGroupsRef.current)
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
