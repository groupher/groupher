import { useMemo } from 'react'

import type { TTagGroup } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

type TPlacementType = 'group' | 'tag'

type TPlacement = {
  type: TPlacementType
  index: number | null
  groupId: string | null
}

type TPlacementIndex = {
  byId: ReadonlyMap<string, readonly TPlacement[]>
  count: number
}

const addPlacement = (byId: Map<string, TPlacement[]>, id: string, placement: TPlacement): void => {
  const key = String(id)
  const placements = byId.get(key)

  if (placements) {
    placements.push(placement)
    return
  }

  byId.set(key, [placement])
}

// Index placements by identity so current state can be checked in one pass.
// Keeping an array per id preserves the old stable-sort behavior for duplicate ids.
export const buildTagPlacementIndex = (tagGroups: readonly TTagGroup[] = []): TPlacementIndex => {
  const byId = new Map<string, TPlacement[]>()
  let count = 0

  for (const group of tagGroups) {
    addPlacement(byId, group.id, {
      type: 'group',
      index: group.index ?? null,
      groupId: null,
    })
    count += 1

    for (const tag of group.tags) {
      if (!tag.id) continue

      addPlacement(byId, tag.id, {
        type: 'tag',
        index: tag.index ?? null,
        groupId: group.id,
      })
      count += 1
    }
  }

  return { byId, count }
}

export const hasTagPlacementChanged = (
  tagGroups: readonly TTagGroup[],
  baseline: TPlacementIndex,
): boolean => {
  const seenById = new Map<string, number>()
  let count = 0

  const matchesBaseline = (
    id: string,
    type: TPlacementType,
    index: number | null,
    groupId: string | null,
  ): boolean => {
    const key = String(id)
    const seenCount = seenById.get(key) ?? 0
    const expected = baseline.byId.get(key)?.[seenCount]

    seenById.set(key, seenCount + 1)
    count += 1

    return expected?.type === type && expected.index === index && expected.groupId === groupId
  }

  for (const group of tagGroups) {
    if (!matchesBaseline(group.id, 'group', group.index ?? null, null)) return true

    for (const tag of group.tags) {
      if (!tag.id) continue

      if (!matchesBaseline(tag.id, 'tag', tag.index ?? null, group.id)) return true
    }
  }

  return count !== baseline.count
}

export default function useIndexTouched(): boolean {
  const dsb$ = useDashboard()
  const tagGroups = dsb$.tagGroups
  const originalTagGroups = dsb$.original.tagGroups || []

  const baseline = useMemo(() => buildTagPlacementIndex(originalTagGroups), [originalTagGroups])

  return useMemo(() => hasTagPlacementChanged(tagGroups, baseline), [baseline, tagGroups])
}
