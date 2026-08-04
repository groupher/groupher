import { useEffect, useRef } from 'react'

import { ARTICLE_STAGE } from '~/const/article'
import { DSB_DOC_EVENT, type TDocDraftPatchPayload } from '~/const/dsb/docs'
import { GRAPHQL_FETCH_OPTIONS } from '~/graphql/client'
import useEvent from '~/hooks/useEvent'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'

import useDocsEditor from '../../store/hooks'
import { composeLoadedDraftSession } from '../helper'
import type { TDocDraftDTO } from '../spec'
import type { TDraftEditorState } from './useDraftEditorState'

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
  const { query } = useGraphQLClient()
  const { revisionReloadKey } = useDocsEditor()
  const loadIdRef = useRef(0)
  const handledReloadKeyRef = useRef(revisionReloadKey)

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

    query<{ docDraft?: TDocDraftDTO }>(
      S.docDraft,
      { community, id: activePage.docId },
      { fetchOptions: { ...GRAPHQL_FETCH_OPTIONS(), signal: abortController.signal } },
    )
      .then((data) => {
        if (loadIdRef.current !== loadId) return

        const session = composeLoadedDraftSession(data?.docDraft, activePage)
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
    query,
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
