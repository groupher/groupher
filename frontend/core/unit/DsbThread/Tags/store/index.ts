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

/** Applies an ID-based order draft over the latest confirmed group data. */
export const applyTagSortOrder = (
  groups: readonly TTagGroup[],
  order: TTagSortOrder | null,
): TTagGroup[] => {
  const sourceGroups = [...groups].sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
  if (!order) return sourceGroups

  return orderByIds(sourceGroups, order.groupIds).map((group, index) => {
    const tags = orderByIds(group.tags, order.tagIdsByGroup[String(group.id)] ?? [])

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
      if (current?.baseline && current.draft && !equals(current.baseline, current.draft)) return
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
