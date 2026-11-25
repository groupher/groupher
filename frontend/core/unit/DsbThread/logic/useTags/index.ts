import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { CHANGE_MODE } from '~/const/mode'
import { Q } from '~/query'
import type { TColorName, TTag, TTagGroup, TThread } from '~/spec'
import { useDsbShellSession } from '~/stores/dsbShell/hooks'
import { applyTagSortOrder } from '~/unit/DsbThread/Tags/store'
import { demoTagGroupsQueryKey, readDemoTagGroups } from '~/unit/DsbThread/Tags/store/demo'
import useTagsEditor from '~/unit/DsbThread/Tags/store/hooks'

import useDerived, { type TRet as TDerived } from './useDerived'
import useUtils from './useUtils'

type TUpdateSession = { source: 'inline' | 'form'; id: number }

type TRet = TDerived & {
  loading: boolean
  saving: boolean
  editingTag: TTag | null
  settingTag: TTag | null
  activeTagGroup: string | null
  activeTagThread: TThread
  changeThread: (thread: TThread) => void
  setActiveGroup: (groupId: string | null) => void
  editTag: (key: 'editingTag' | 'settingTag', tag: TTag | null) => void
  createGroup: (title: string) => Promise<void>
  createTag: (title: string, groupId: string, color?: TColorName) => Promise<void>
  createTagFromForm: (tag: TTag, session: number) => Promise<void>
  updateTag: (tag: TTag, session?: TUpdateSession) => Promise<void>
  deleteTag: (tag: TTag, session: number) => Promise<void>
  renameGroup: (groupId: string, toGroup: string) => Promise<void>
  commitTagSorting: (tagGroups: TTagGroup[]) => void
  saveTagSorting: () => Promise<void>
  resetTagSorting: () => void
  hasSortingChanges: boolean
}

/** Exposes Tags page data and actions while Query owns confirmed tag groups. */
export default function useTags(): TRet {
  const tagsEditor = useTagsEditor()
  const activeTagThread = tagsEditor.activeThread
  const { demoMode } = useDsbShellSession()
  const tagGroupsOptions = Q.article.tagGroups(tagsEditor.community, activeTagThread)
  const tagGroupsQuery = useQuery({
    ...tagGroupsOptions,
    ...(demoMode
      ? {
          queryKey: demoTagGroupsQueryKey(tagsEditor.community, activeTagThread),
          initialData: readDemoTagGroups(tagsEditor.community, activeTagThread),
          staleTime: Number.POSITIVE_INFINITY,
        }
      : {}),
  } as UseQueryOptions<TTagGroup[]>)
  const confirmedTagGroups = tagGroupsQuery.data ?? []
  const sortState = tagsEditor.sorting[activeTagThread]
  const tagGroups = useMemo(
    () => applyTagSortOrder(confirmedTagGroups, sortState?.draft ?? null),
    [confirmedTagGroups, sortState?.draft],
  )
  const derived = useDerived(tagGroups, tagsEditor.activeGroupId)

  const {
    createGroup,
    createTag,
    createTagFromForm,
    updateTag,
    deleteTag,
    commitTagSorting,
    saveTagSorting,
    resetTagSorting,
    hasSortingChanges,
    renameGroup,
    saving,
  } = useUtils(confirmedTagGroups, activeTagThread)

  useEffect(() => {
    if (tagGroupsQuery.data) {
      tagsEditor.store.syncConfirmedOrder(activeTagThread, tagGroupsQuery.data)
    }
  }, [activeTagThread, tagGroupsQuery.data, tagsEditor.store])

  const editTag = (key: 'editingTag' | 'settingTag', tag: TTag | null): void => {
    if (key === 'editingTag') {
      if (tag) tagsEditor.store.beginInlineEdit(tag)
      else tagsEditor.store.clearInlineEdit()
      return
    }

    if (tag) tagsEditor.store.beginTagForm(CHANGE_MODE.UPDATE, tag)
    else tagsEditor.store.clearTagForm()
  }

  const changeThread = (thread: TThread): void => {
    tagsEditor.store.setActiveThread(thread)
  }

  return {
    activeTagGroup: tagsEditor.activeGroupId,
    activeTagThread,
    editingTag: tagsEditor.inlineTagDraft,
    settingTag: tagsEditor.tagFormMode === CHANGE_MODE.UPDATE ? tagsEditor.tagFormDraft : null,
    loading: tagGroupsQuery.isPending || tagGroupsQuery.isFetching,
    ...derived,
    saving,
    changeThread,
    setActiveGroup: (groupId) => tagsEditor.store.setActiveGroup(groupId),
    editTag,
    createGroup,
    createTag,
    createTagFromForm,
    updateTag,
    deleteTag,
    renameGroup,
    commitTagSorting,
    saveTagSorting: () => saveTagSorting(tagGroups),
    resetTagSorting,
    hasSortingChanges,
  }
}
