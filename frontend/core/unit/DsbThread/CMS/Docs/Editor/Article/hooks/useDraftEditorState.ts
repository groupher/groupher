import type { TRichEditorValue } from '@groupher/rich-editor'
import { useEffect, useMemo } from 'react'

import { slugify } from '~/lib/slug'

import { SIDE_TREE_NODE_TYPE } from '../../SideTree/constant'
import { findChild } from '../../SideTree/helper'
import type { TSideTreeController, TSideTreePage } from '../../SideTree/spec'
import { useDocsEditorStore } from '../../store/hooks'
import type { TApplySavedParams } from '../../store/spec'
import { countEditorText, isDraftDirty } from '../helper'
import type {
  TDraftLoadStatus,
  TDraftSaveStatus,
  TDocDraftSession,
  TDocDraftSource,
  TEditorDraft,
  TEditorDraftMeta,
  TSavedDraft,
} from '../spec'

export type TDraftEditorState = {
  workingCopyId: string | null
  publicSnapshotId: string | null
  activePage: TSideTreePage | null
  bodyStats: ReturnType<typeof countEditorText>
  dirty: boolean
  draft: TEditorDraft
  editable: boolean
  invalid: boolean
  loadStatus: TDraftLoadStatus
  meta: TEditorDraftMeta
  savedDraft: TSavedDraft
  draftSource: TDocDraftSource
  saveStatus: TDraftSaveStatus
  applyDraftPatch: (patch: Partial<TEditorDraftMeta>) => void
  applyLoaded: (session: TDocDraftSession) => void
  reconcileConflict: (session: TDocDraftSession) => void
  applySaved: (params: TApplySavedParams) => void
  clearSaveError: () => void
  editBodyValue: (value: TRichEditorValue) => void
  editSubtitle: (value: string) => void
  editTitle: (value: string) => void
  resetDraft: () => void
  setDraftSlug: (slug: string) => void
  setLoadError: (error: string) => void
  setLoading: () => void
  setSaveError: (error: string) => void
  setSaving: () => void
}

const resolveActivePage = (sideTree: TSideTreeController): TSideTreePage | null => {
  const activeChild = sideTree.activeId ? findChild(sideTree.groups, sideTree.activeId) : null
  return activeChild?.type === SIDE_TREE_NODE_TYPE.PAGE && activeChild.docId ? activeChild : null
}

/** Reads the authoritative DocsEditorStore and derives the active editor view. */
export default function useDraftEditorState(sideTree: TSideTreeController): TDraftEditorState {
  const store = useDocsEditorStore()
  const activePage = useMemo(
    () => resolveActivePage(sideTree),
    [sideTree.activeId, sideTree.groups],
  )
  const bodyStats = useMemo(() => countEditorText(store.draft.bodyValue), [store.draft.bodyValue])
  const dirty = isDraftDirty(store.draft, store.savedDraft)
  const editable = !!activePage?.docId && !!store.workingCopyId
  const invalid = !store.draft.title.trim()

  useEffect(() => {
    const trimmedTitle = store.draft.title.trim()
    if (!activePage || !trimmedTitle) {
      store.setDraftSlug('')
      return
    }

    let canceled = false
    const timer = window.setTimeout(() => {
      slugify(trimmedTitle)
        .then((slug) => {
          if (!canceled) store.setDraftSlug(slug)
        })
        .catch(() => {
          if (!canceled) store.setDraftSlug('')
        })
    }, 260)

    return () => {
      canceled = true
      window.clearTimeout(timer)
    }
  }, [activePage, store.draft.title, store.setDraftSlug])

  return {
    workingCopyId: store.workingCopyId,
    publicSnapshotId: store.publicSnapshotId,
    activePage,
    bodyStats,
    dirty,
    draft: store.draft,
    editable,
    invalid,
    loadStatus: store.loadStatus,
    meta: store.meta,
    savedDraft: store.savedDraft,
    draftSource: store.draftSource,
    saveStatus: store.draftSaveStatus,
    applyDraftPatch: store.applyDraftPatch,
    applyLoaded: store.applyLoaded,
    reconcileConflict: store.reconcileConflict,
    applySaved: store.applySaved,
    clearSaveError: store.clearSaveError,
    editBodyValue: store.editBodyValue,
    editSubtitle: store.editSubtitle,
    editTitle: store.editTitle,
    resetDraft: store.resetDraft,
    setDraftSlug: store.setDraftSlug,
    setLoadError: store.setLoadError,
    setLoading: store.setLoading,
    setSaveError: store.setSaveError,
    setSaving: store.setSaving,
  }
}
