import { useEffect } from 'react'

import useDocsEditor from '../../store/hooks'
import { composeDraftEditorStorePatch, composeEmptyDraftEditorStorePatch } from '../helper'
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

    const hasError = !dirty && !!(loadStatus.error || saveStatus.error)
    const saveError = hasError ? loadStatus.error || saveStatus.error : null
    const storeSaveStatus = saveStatus.saving
      ? 'saving'
      : hasError
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
