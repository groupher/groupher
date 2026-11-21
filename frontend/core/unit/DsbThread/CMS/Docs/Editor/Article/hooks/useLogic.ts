import type { TSideTreeController } from '../../SideTree/spec'
import useBeginDocEdit from './useBeginDocEdit'
import useDraftAutoSave from './useDraftAutoSave'
import useDraftEditorState from './useDraftEditorState'
import useDraftLoader from './useDraftLoader'
import useDraftStoreSync from './useDraftStoreSync'
import useLocalDraftHistory from './useLocalDraftHistory'

/** Exposes logic state and actions through the shared React hook boundary. */
export default function useLogic(sideTree: TSideTreeController) {
  const draftState = useDraftEditorState(sideTree)
  const { save } = useDraftAutoSave(draftState, {
    patchSideTreeChild: sideTree.patchChild,
  })

  const begin = useBeginDocEdit(draftState)
  useDraftLoader(draftState)
  const localDraftHistory = useLocalDraftHistory(draftState)
  useDraftStoreSync(draftState)

  return {
    ...begin,
    canBeginEdit: !!draftState.publicSnapshotId && !draftState.workingCopyId && !draftState.dirty,
    activePage: draftState.activePage,
    bodyValue: draftState.draft.bodyValue,
    dirty: draftState.dirty,
    editable: draftState.editable,
    editorDocId: draftState.loadStatus.loadedDocId ?? '',
    error: draftState.saveStatus.error || draftState.loadStatus.error,
    invalid: draftState.invalid,
    loading: draftState.loadStatus.loading,
    localDraftHistory,
    save,
    saving: draftState.saveStatus.saving,
    setBodyValue: draftState.editBodyValue,
    setSubtitle: draftState.editSubtitle,
    setTitle: draftState.editTitle,
    slug: draftState.draft.slug,
    subtitle: draftState.draft.subtitle,
    title: draftState.draft.title,
  }
}
