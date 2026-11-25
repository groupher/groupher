'use client'

import { useContext } from 'react'
import { useSnapshot } from 'valtio'

import type { TChangeMode, TTag, TThread } from '~/spec'

import { TagsEditorContext } from './context'
import type { TTagSortState, TTagsEditorStore } from './index'

type TRet = {
  readonly community: string
  readonly activeThread: TThread
  readonly activeGroupId: string | null
  readonly inlineTagDraft: TTag | null
  readonly inlineEditSession: number
  readonly tagFormDraft: TTag | null
  readonly tagFormMode: TChangeMode | null
  readonly tagFormSession: number
  readonly tagFormSlugEdited: boolean
  readonly sorting: Partial<Record<TThread, TTagSortState>>
  store: TTagsEditorStore
}

/** Exposes a Tags editor session and keeps query data outside the store. */
export default function useTagsEditor(): TRet {
  const store = useContext(TagsEditorContext)
  if (!store) throw new Error('useTagsEditor must be used within TagsEditorProvider')

  const snapshot = useSnapshot(store)

  return {
    get community() {
      return snapshot.community
    },
    get activeThread() {
      return snapshot.activeThread
    },
    get activeGroupId() {
      return snapshot.activeGroupId
    },
    get inlineTagDraft() {
      return snapshot.inlineTagDraft as TTag | null
    },
    get inlineEditSession() {
      return snapshot.inlineEditSession
    },
    get tagFormDraft() {
      return snapshot.tagFormDraft as TTag | null
    },
    get tagFormMode() {
      return snapshot.tagFormMode
    },
    get tagFormSession() {
      return snapshot.tagFormSession
    },
    get tagFormSlugEdited() {
      return snapshot.tagFormSlugEdited
    },
    get sorting() {
      return snapshot.sorting
    },
    store,
  }
}
