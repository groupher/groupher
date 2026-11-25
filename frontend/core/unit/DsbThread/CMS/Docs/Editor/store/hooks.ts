'use client'

import { useMemo } from 'react'

import createStoreHook from '~/stores/createStoreHook'

import { isDraftDirty } from '../Article/helper'
import useDocsEditorCommands from '../commands/hooks'
import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import { findChild } from '../SideTree/helper'
import { StoreContext } from './context'
import { buildPublishView, deriveDocDraftInfo, deriveDocSaveStatus } from './index'

export const useDocsEditorStore = createStoreHook(StoreContext, [
  'applyDraftPatch',
  'applyLoaded',
  'reconcileConflict',
  'applySaved',
  'clearSaveError',
  'editBodyValue',
  'editSubtitle',
  'editTitle',
  'resetDraft',
  'setDraftSlug',
  'setLoadError',
  'setLoading',
  'setSaveError',
  'setSaving',
  'reloadDocDraft',
  'setMode',
  'setPublishRuntime',
])

/** Exposes current Docs editor state and derives its cross-region read model. */
export default function useDocsEditor() {
  const state = useDocsEditorStore()
  const commands = useDocsEditorCommands()
  const dirty = isDraftDirty(state.draft, state.savedDraft)
  const saveStatus = deriveDocSaveStatus(
    state.draft,
    state.savedDraft,
    state.loadStatus,
    state.draftSaveStatus,
  )
  const activeNode = commands.sideTree.activeId
    ? findChild(commands.sideTree.groups, commands.sideTree.activeId)
    : null
  const activePage =
    activeNode?.type === SIDE_TREE_NODE_TYPE.PAGE && activeNode.docId ? activeNode : null
  const docDraftInfo = useMemo(
    () => deriveDocDraftInfo(state, activePage?.publishState ?? null),
    [activePage?.publishState, state.draft, state.meta, state.workingCopyId],
  )
  const saveError = !dirty ? state.loadStatus.error || state.draftSaveStatus.error : null
  const publishView = useMemo(
    () => buildPublishView(commands.sideTree, saveStatus, state.publishRuntime),
    [commands.sideTree, saveStatus, state.publishRuntime],
  )

  return {
    get mode() {
      return state.mode
    },
    get publishRuntime() {
      return state.publishRuntime
    },
    get revisionReloadKey() {
      return state.revisionReloadKey
    },
    setMode: state.setMode,
    setPublishRuntime: state.setPublishRuntime,
    reloadDocDraft: state.reloadDocDraft,
    addGroup: commands.addGroup,
    reloadSideTree: commands.reloadSideTree,
    saveDocDraft: commands.saveDocDraft,
    docDraftInfo,
    publishView,
    saveError,
    saveStatus,
  }
}
