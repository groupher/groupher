import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { sortByIndex } from '~/helper'
import type { TTag, TThread } from '~/spec'

import type { TDraftGroup, TGroupListItem, TTagDragTarget } from './types'

const UNGROUPED_GROUP = 'Ungrouped'
const UNGROUPED_KEY = '__ungrouped__'

type TProps = {
  tags: readonly TTag[]
  draftGroups: readonly TDraftGroup[]
  currentThread: TThread
  onCommit: (tags: TTag[]) => void
}

type TRet = {
  groups: TGroupListItem[]
  groupNames: string[]
  startDrag: (tagId: string) => void
  moveDrag: (target?: TTagDragTarget | null) => void
  commitDrag: (target?: TTagDragTarget | null) => void
  cancelDrag: () => void
}

const realGroupKey = (group?: string | null): string => group || UNGROUPED_KEY
const draftGroupKey = (draftId: string): string => `draft:${draftId}`

const buildGroups = (
  tags: readonly TTag[],
  draftGroups: readonly TDraftGroup[],
  currentThread: TThread,
): TGroupListItem[] => {
  const groupedTags = new Map<string, TTag[]>()

  for (const tag of tags) {
    const key = realGroupKey(tag.group)
    const groupTags = groupedTags.get(key)

    if (groupTags) {
      groupTags.push(tag)
    } else {
      groupedTags.set(key, [tag])
    }
  }

  const realGroups: TGroupListItem[] = Array.from(groupedTags.entries()).map(([key, groupTags]) => {
    const firstTag = groupTags[0]
    const group = firstTag.group || null

    return {
      key,
      title: group || UNGROUPED_GROUP,
      group,
      tags: sortByIndex(groupTags),
      draft: false,
    }
  })

  const draftItems: TGroupListItem[] = draftGroups
    .filter((group) => group.thread === currentThread)
    .map((group) => {
      const matchingRealGroup = realGroups.find((item) => item.title === group.title)

      return {
        key: draftGroupKey(group.id),
        title: group.title,
        group: group.title,
        tags: matchingRealGroup?.tags || [],
        draft: true,
        draftId: group.id,
      }
    })

  const draftTitles = new Set(draftItems.map((group) => group.title).filter(Boolean))

  return [...draftItems, ...realGroups.filter((group) => !draftTitles.has(group.title))]
}

const moveTagInGroups = (
  groups: TGroupListItem[],
  tagId: string,
  target: TTagDragTarget,
): TGroupListItem[] => {
  const sourceGroup = groups.find((group) => group.tags.some((tag) => tag.id === tagId))
  const targetGroup = groups.find((group) => group.key === target.groupKey)

  if (!sourceGroup || !targetGroup || target.tagId === tagId) return groups

  const movingTag = sourceGroup.tags.find((tag) => tag.id === tagId)
  if (!movingTag) return groups

  const sourceTags = sourceGroup.tags.filter((tag) => tag.id !== tagId)
  const targetBase =
    sourceGroup.key === targetGroup.key
      ? sourceTags
      : targetGroup.tags.filter((tag) => tag.id !== tagId)

  const targetTagIndex = target.tagId
    ? targetBase.findIndex((tag) => tag.id === target.tagId)
    : targetBase.length
  const targetIndex =
    targetTagIndex >= 0 ? targetTagIndex + (target.position === 'after' ? 1 : 0) : targetBase.length
  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, targetBase.length))
  const movedTag = { ...movingTag, group: targetGroup.group || undefined }
  const targetTags = [
    ...targetBase.slice(0, boundedTargetIndex),
    movedTag,
    ...targetBase.slice(boundedTargetIndex),
  ]

  return groups.map((group) => {
    if (group.key === sourceGroup.key && group.key !== targetGroup.key) {
      return {
        ...group,
        tags: sourceTags.map((tag, index) => ({ ...tag, index })),
      }
    }

    if (group.key === targetGroup.key) {
      return {
        ...group,
        tags: targetTags.map((tag, index) => ({ ...tag, index })),
      }
    }

    return group
  })
}

const flattenGroups = (groups: readonly TGroupListItem[]): TTag[] => {
  return groups.flatMap((group) =>
    group.tags.map((tag, index) => ({
      ...tag,
      group: group.group || undefined,
      index,
    })),
  )
}

const isSamePlacement = (
  left: readonly TGroupListItem[],
  right: readonly TGroupListItem[],
): boolean => {
  const leftTags = flattenGroups(left)
  const rightTags = flattenGroups(right)

  if (leftTags.length !== rightTags.length) return false

  return leftTags.every((tag, index) => {
    const other = rightTags[index]

    return (
      tag.id === other?.id &&
      (tag.group || null) === (other.group || null) &&
      tag.index === other.index
    )
  })
}

export default function useTagDragDraft({
  tags,
  draftGroups,
  currentThread,
  onCommit,
}: TProps): TRet {
  const sourceGroups = useMemo(
    () => buildGroups(tags, draftGroups, currentThread),
    [currentThread, draftGroups, tags],
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

  const startDrag = useCallback((tagId: string): void => {
    activeIdRef.current = tagId
    draggingRef.current = true
    baselineGroupsRef.current = latestGroupsRef.current
  }, [])

  const moveDrag = useCallback((target?: TTagDragTarget | null): void => {
    const activeId = activeIdRef.current
    if (!activeId || !target?.groupKey) return

    const currentGroups = latestGroupsRef.current
    const sourceGroup = currentGroups.find((group) => group.tags.some((tag) => tag.id === activeId))

    if (!sourceGroup || sourceGroup.key === target.groupKey) return

    const nextGroups = moveTagInGroups(currentGroups, activeId, target)
    if (nextGroups === currentGroups || isSamePlacement(currentGroups, nextGroups)) return

    latestGroupsRef.current = nextGroups
    setGroups(nextGroups)
  }, [])

  const commitDrag = useCallback(
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
    moveDrag,
    commitDrag,
    cancelDrag,
  }
}
