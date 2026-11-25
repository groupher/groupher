import { clone, equals } from 'ramda'
import { proxy } from 'valtio'

import { THREAD } from '~/const/thread'
import type { TChangeMode, TTag, TTagGroup, TThread } from '~/spec'

export type TTagSortOrder = {
  readonly groupIds: readonly string[]
  readonly tagIdsByGroup: Readonly<Record<string, readonly string[]>>
}

export type TTagSortState = {
  baseline: TTagSortOrder | null
  draft: TTagSortOrder | null
}

export type TTagsEditorStore = {
  community: string
  activeThread: TThread
  activeGroupId: string | null
  inlineTagDraft: TTag | null
  inlineEditSession: number
  tagFormDraft: TTag | null
  tagFormMode: TChangeMode | null
  tagFormSession: number
  tagFormSlugEdited: boolean
  sorting: Partial<Record<TThread, TTagSortState>>
  setActiveThread: (thread: TThread) => void
  setActiveGroup: (groupId: string | null) => void
  beginInlineEdit: (tag: TTag) => number
  updateInlineDraft: (patch: Partial<TTag>) => void
  clearInlineEdit: (session?: number) => void
  beginTagForm: (mode: TChangeMode, tag: TTag) => number
  markTagFormSlugEdited: () => void
  updateTagForm: (patch: Partial<TTag>) => void
  clearTagForm: (session?: number) => void
  syncConfirmedOrder: (thread: TThread, groups: readonly TTagGroup[]) => void
  setSortingDraft: (thread: TThread, order: TTagSortOrder) => void
  resetSorting: (thread: TThread) => void
  reconcileSorting: (thread: TThread, submitted: TTagSortOrder, confirmed: TTagSortOrder) => void
  getSortingDraft: (thread: TThread) => TTagSortOrder | null
  hasSortingChanges: (thread: TThread) => boolean
}

/** Converts confirmed group and tag indexes into the editor's stable ID order. */
export const tagSortOrderFromGroups = (groups: readonly TTagGroup[]): TTagSortOrder => {
  const orderedGroups = [...groups].sort((left, right) => (left.index ?? 0) - (right.index ?? 0))

  return {
    groupIds: orderedGroups.map((group) => String(group.id)),
    tagIdsByGroup: Object.fromEntries(
      orderedGroups.map((group) => [
        String(group.id),
        [...group.tags]
          .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
          .flatMap((tag) => (tag.id ? [String(tag.id)] : [])),
      ]),
    ),
  }
}

const orderByIds = <T extends { id?: string }>(
  items: readonly T[],
  ids: readonly string[],
): T[] => {
  const byId = new Map(items.flatMap((item) => (item.id ? [[String(item.id), item] as const] : [])))
  const ordered = ids.flatMap((id) => {
    const item = byId.get(id)
    if (!item) return []
    byId.delete(id)
    return [item]
  })

  return [...ordered, ...byId.values()]
}

const groupByTagId = (order: TTagSortOrder): Map<string, string> => {
  const groupById = new Map<string, string>()

  for (const groupId of order.groupIds) {
    for (const tagId of order.tagIdsByGroup[groupId] ?? []) {
      if (!groupById.has(tagId)) groupById.set(tagId, groupId)
    }
  }

  return groupById
}

/** Reconciles server membership changes while retaining unsaved order and group moves. */
const rebaseTagSortOrder = (
  baseline: TTagSortOrder,
  draft: TTagSortOrder,
  confirmed: TTagSortOrder,
): TTagSortOrder => {
  const baselineGroupByTag = groupByTagId(baseline)
  const draftGroupByTag = groupByTagId(draft)
  const confirmedGroupByTag = groupByTagId(confirmed)
  const confirmedGroupIds = new Set(confirmed.groupIds)
  const nextGroupByTag = new Map<string, string>()
  const tagIds = new Set([
    ...baselineGroupByTag.keys(),
    ...draftGroupByTag.keys(),
    ...confirmedGroupByTag.keys(),
  ])

  for (const tagId of tagIds) {
    const baselineGroupId = baselineGroupByTag.get(tagId)
    const draftGroupId = draftGroupByTag.get(tagId)
    const confirmedGroupId = confirmedGroupByTag.get(tagId)
    const hasDraftMove =
      baselineGroupId !== undefined &&
      draftGroupId !== undefined &&
      draftGroupId !== baselineGroupId &&
      confirmedGroupIds.has(draftGroupId)
    const nextGroupId = hasDraftMove
      ? draftGroupId
      : (confirmedGroupId ?? (!baselineGroupId ? draftGroupId : undefined))

    if (nextGroupId && confirmedGroupIds.has(nextGroupId)) nextGroupByTag.set(tagId, nextGroupId)
  }

  const preserveDraftGroupOrder = !equals(draft.groupIds, baseline.groupIds)
  const groupIds = [...(preserveDraftGroupOrder ? draft.groupIds : confirmed.groupIds)].filter(
    (groupId, index, all) => confirmedGroupIds.has(groupId) && all.indexOf(groupId) === index,
  )
  for (const groupId of confirmed.groupIds) {
    if (!groupIds.includes(groupId)) groupIds.push(groupId)
  }

  const tagIdsByGroup = Object.fromEntries(
    groupIds.map((groupId) => {
      const baselineTagIds = baseline.tagIdsByGroup[groupId] ?? []
      const draftTagIds = draft.tagIdsByGroup[groupId] ?? []
      const confirmedTagIds = confirmed.tagIdsByGroup[groupId] ?? []
      const preserveDraftTagOrder = !equals(draftTagIds, baselineTagIds)
      const sourceTagIds = preserveDraftTagOrder ? draftTagIds : confirmedTagIds
      const nextTagIds: string[] = []

      for (const tagId of [...sourceTagIds, ...confirmedTagIds, ...draftTagIds]) {
        if (nextGroupByTag.get(tagId) !== groupId || nextTagIds.includes(tagId)) continue
        nextTagIds.push(tagId)
      }

      return [groupId, nextTagIds]
    }),
  )

  return { groupIds, tagIdsByGroup }
}

/** Applies an ID-based order draft over the latest confirmed group data. */
export const applyTagSortOrder = (
  groups: readonly TTagGroup[],
  order: TTagSortOrder | null,
): TTagGroup[] => {
  const sourceGroups = [...groups].sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
  if (!order) return sourceGroups

  const tagsById = new Map(
    sourceGroups.flatMap((group) =>
      group.tags.flatMap((tag) => (tag.id ? [[String(tag.id), tag] as const] : [])),
    ),
  )
  const assignedGroupByTagId = new Map<string, string>()

  for (const groupId of order.groupIds) {
    for (const tagId of order.tagIdsByGroup[groupId] ?? []) {
      if (!assignedGroupByTagId.has(tagId)) assignedGroupByTagId.set(tagId, groupId)
    }
  }

  return orderByIds(sourceGroups, order.groupIds).map((group, index) => {
    const groupId = String(group.id)
    const tagIds = order.tagIdsByGroup[groupId] ?? []
    const includedTagIds = new Set<string>()
    const orderedTags = tagIds.flatMap((tagId) => {
      if (includedTagIds.has(tagId) || assignedGroupByTagId.get(tagId) !== groupId) return []
      includedTagIds.add(tagId)
      const tag = tagsById.get(tagId)
      return tag ? [tag] : []
    })
    const unassignedTags = group.tags.filter(
      (tag) => !tag.id || !assignedGroupByTagId.has(String(tag.id)),
    )
    const tags = [...orderedTags, ...unassignedTags]

    return {
      ...group,
      index,
      tags: tags.map((tag, tagIndex) => ({
        ...tag,
        groupId: group.id,
        index: tagIndex,
      })),
    }
  })
}

/** Creates one community-scoped Tags editor session. */
export const createTagsEditorStore = (community: string): TTagsEditorStore => {
  let store: TTagsEditorStore
  let sessionId = 0

  const nextSession = (): number => {
    sessionId += 1
    return sessionId
  }

  const setSortState = (thread: TThread, state: TTagSortState): void => {
    store.sorting = { ...store.sorting, [thread]: state }
  }

  store = proxy({
    community,
    activeThread: THREAD.POST,
    activeGroupId: null,
    inlineTagDraft: null,
    inlineEditSession: 0,
    tagFormDraft: null,
    tagFormMode: null,
    tagFormSession: 0,
    tagFormSlugEdited: false,
    sorting: {},
    setActiveThread: (thread: TThread): void => {
      store.activeThread = thread
      store.activeGroupId = null
      store.clearInlineEdit()
      store.clearTagForm()
    },
    setActiveGroup: (groupId: string | null): void => {
      store.activeGroupId = groupId
    },
    beginInlineEdit: (tag: TTag): number => {
      const session = nextSession()
      store.inlineTagDraft = clone(tag)
      store.inlineEditSession = session
      store.tagFormDraft = null
      store.tagFormMode = null
      store.tagFormSession = nextSession()
      return session
    },
    updateInlineDraft: (patch: Partial<TTag>): void => {
      if (store.inlineTagDraft) store.inlineTagDraft = { ...store.inlineTagDraft, ...patch }
    },
    clearInlineEdit: (session?: number): void => {
      if (session !== undefined && session !== store.inlineEditSession) return
      store.inlineTagDraft = null
      store.inlineEditSession = nextSession()
    },
    beginTagForm: (mode: TChangeMode, tag: TTag): number => {
      const session = nextSession()
      store.tagFormDraft = clone(tag)
      store.tagFormMode = mode
      store.tagFormSession = session
      store.tagFormSlugEdited = false
      store.inlineTagDraft = null
      store.inlineEditSession = nextSession()
      return session
    },
    markTagFormSlugEdited: (): void => {
      store.tagFormSlugEdited = true
    },
    updateTagForm: (patch: Partial<TTag>): void => {
      if (store.tagFormDraft) store.tagFormDraft = { ...store.tagFormDraft, ...patch }
    },
    clearTagForm: (session?: number): void => {
      if (session !== undefined && session !== store.tagFormSession) return
      store.tagFormDraft = null
      store.tagFormMode = null
      store.tagFormSession = nextSession()
      store.tagFormSlugEdited = false
    },
    syncConfirmedOrder: (thread: TThread, groups: readonly TTagGroup[]): void => {
      const confirmed = tagSortOrderFromGroups(groups)
      const current = store.sorting[thread]
      if (current?.baseline && current.draft && !equals(current.baseline, current.draft)) {
        setSortState(thread, {
          baseline: clone(confirmed),
          draft: rebaseTagSortOrder(current.baseline, current.draft, confirmed),
        })
        return
      }
      setSortState(thread, { baseline: clone(confirmed), draft: clone(confirmed) })
    },
    setSortingDraft: (thread: TThread, order: TTagSortOrder): void => {
      const current = store.sorting[thread]
      const baseline = current?.baseline ?? clone(order)
      setSortState(thread, { baseline, draft: clone(order) })
    },
    resetSorting: (thread: TThread): void => {
      const current = store.sorting[thread]
      if (!current?.baseline) return
      setSortState(thread, { baseline: current.baseline, draft: clone(current.baseline) })
    },
    reconcileSorting: (thread, submitted, confirmed): void => {
      const current = store.sorting[thread]
      const draft = current?.draft ?? submitted
      setSortState(thread, {
        baseline: clone(confirmed),
        draft: equals(draft, submitted) ? clone(confirmed) : clone(draft),
      })
    },
    getSortingDraft: (thread): TTagSortOrder | null => {
      const state = store.sorting[thread]
      return state?.draft ? clone(state.draft) : null
    },
    hasSortingChanges: (thread): boolean => {
      const state = store.sorting[thread]
      return Boolean(state?.baseline && state.draft && !equals(state.baseline, state.draft))
    },
  } as TTagsEditorStore)

  return store
}
