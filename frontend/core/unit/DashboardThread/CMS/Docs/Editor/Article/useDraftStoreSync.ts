import { useEffect } from 'react'

import useDocsEditor from '../store/hooks'
import { composeDraftEditorStorePatch, composeEmptyDraftEditorStorePatch } from './helper'
import type { TDraftEditorState } from './useDraftEditorState'

export default function useDraftStoreSync(draftState: TDraftEditorState): void {
  const { setDocDraftSession } = useDocsEditor()
  const { activePage, bodyStats, dirty, draft, loadStatus, meta, savedDraft, saveStatus } =
    draftState

  useEffect(() => {
    if (!draft.docId) {
      setDocDraftSession(composeEmptyDraftEditorStorePatch())
      return
    }

    const saveError = dirty ? null : loadStatus.error || saveStatus.error
    const storeSaveStatus = saveStatus.saving
      ? 'saving'
      : loadStatus.error || saveStatus.error
        ? 'error'
        : dirty
          ? 'dirty'
          : 'saved'

    setDocDraftSession(
      composeDraftEditorStorePatch({
        bodyStats,
        draft,
        meta,
        publishState: activePage?.publishState ?? null,
        saveError,
        savedDraft,
        saveStatus: storeSaveStatus,
      }),
    )
  }, [
    activePage?.publishState,
    bodyStats,
    dirty,
    draft,
    loadStatus.error,
    meta,
    savedDraft,
    saveStatus.error,
    saveStatus.saving,
    setDocDraftSession,
  ])
}
