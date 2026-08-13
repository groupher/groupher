import type { TSideTreeController } from '../../SideTree/spec'
import type { TDocDraftInitialData } from '../spec'
import useDraftAutoSave from './useDraftAutoSave'
import useDraftEditorState from './useDraftEditorState'
import useDraftLoader from './useDraftLoader'
import useDraftSnapshot from './useDraftSnapshot'
import useDraftStoreSync from './useDraftStoreSync'

/** Exposes logic state and actions through the shared React hook boundary. */
export default function useLogic(
  sideTree: TSideTreeController,
  initialData?: TDocDraftInitialData | null,
) {
  const draftState = useDraftEditorState(sideTree, initialData)
  const { save } = useDraftAutoSave(draftState, {
    patchSideTreeChild: sideTree.patchChild,
  })

  useDraftLoader(draftState)
  useDraftSnapshot(draftState)
  useDraftStoreSync(draftState)

  return {
    activePage: draftState.activePage,
    bodyValue: draftState.draft.bodyValue,
    dirty: draftState.dirty,
    editable: draftState.editable,
    editorDocId: draftState.loadStatus.loadedDocId ?? '',
    error: draftState.saveStatus.error || draftState.loadStatus.error,
    invalid: draftState.invalid,
    loading: draftState.loadStatus.loading,
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
