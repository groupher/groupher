import { useEffect, useRef } from 'react'

import { ARTICLE_STAGE } from '~/const/article'
import { DSB_DOC_EVENT, type TDocDraftPatchPayload } from '~/const/dsb/docs'
import { browserGraphQLRequest } from '~/graphql/client'
import useEvent from '~/hooks/useEvent'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DsbThread/schema/docs'

import { useDocsEditorStore } from '../../store/hooks'
import { composePublicSnapshotSession, composeWorkingCopySession } from '../helper'
import type { TDocEditorSource } from '../spec'
import type { TDraftEditorState } from './useDraftEditorState'

/** Exposes draft loader state and actions through the shared React hook boundary. */
export default function useDraftLoader(draftState: TDraftEditorState): void {
  const {
    activePage,
    applyDraftPatch,
    applyLoaded,
    loadStatus,
    resetDraft,
    setLoadError,
    setLoading,
  } = draftState
  const { slug: community } = useCommunity()
  const { revisionReloadKey } = useDocsEditorStore()
  const loadIdRef = useRef(0)
  const handledReloadKeyRef = useRef(revisionReloadKey)
  const dirtyRef = useRef(draftState.dirty)
  dirtyRef.current = draftState.dirty

  useEffect(() => {
    loadIdRef.current += 1
    const loadId = loadIdRef.current

    if (!activePage?.docId) {
      resetDraft()
      return
    }

    const reloadRequested = revisionReloadKey !== handledReloadKeyRef.current

    if (activePage.docId === loadStatus.loadedDocId && !reloadRequested) {
      return
    }

    handledReloadKeyRef.current = revisionReloadKey
    if (loadStatus.loadedDocId !== null && activePage.docId !== loadStatus.loadedDocId) {
      resetDraft()
    }
    setLoading()

    const abortController = new AbortController()

    browserGraphQLRequest<{ docsEditor: TDocEditorSource }>(
      S.docsEditor,
      { community, articleId: activePage.docId },
      { signal: abortController.signal },
    )
      .then((data) => {
        if (loadIdRef.current !== loadId) return
        if (reloadRequested && dirtyRef.current) {
          setLoadError('The server copy changed. Your local edits were preserved.')
          return
        }

        const { workingCopy: copy, publicSnapshot } = data.docsEditor
        if (!copy && !publicSnapshot) throw new Error('Doc editor source not found')
        const session = copy
          ? composeWorkingCopySession(copy, activePage)
          : composePublicSnapshotSession(publicSnapshot!, activePage)
        applyLoaded(session)
      })
      .catch((err) => {
        if (loadIdRef.current !== loadId || abortController.signal.aborted) return
        setLoadError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (loadIdRef.current !== loadId || abortController.signal.aborted) return
      })

    return () => abortController.abort()
  }, [
    activePage,
    activePage?.docId,
    activePage?.id,
    applyLoaded,
    community,
    loadStatus.loadedDocId,
    resetDraft,
    revisionReloadKey,
    setLoadError,
    setLoading,
  ])

  useEvent<TDocDraftPatchPayload>(
    DSB_DOC_EVENT.DRAFT_PATCH,
    (_msg, detail): void => {
      if (!detail) return
      if (!activePage?.docId || detail?.docId !== activePage.docId) return

      applyDraftPatch({ stage: detail.stage ?? ARTICLE_STAGE.DRAFT })
    },
    [activePage?.docId, applyDraftPatch],
  )
}
