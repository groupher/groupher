import { useEffect, useRef, useState } from 'react'

import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import { send } from '~/lib/signal'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DashboardThread/schema/docs'

import { REVISION_LABEL_KEY } from '../../../ActionSnackbar/constant'
import { DOC_DRAFT_REVISION_CHECKPOINT_DELAY } from '../constant'
import type { TDraftSnapshotStatus } from '../spec'
import type { TDraftEditorState } from './useDraftEditorState'

/** Exposes draft snapshot state and actions through the shared React hook boundary. */
export default function useDraftSnapshot(draftState: TDraftEditorState): void {
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()
  const { activePage, draftSource, editable, invalid, loadStatus, savedDraft, saveStatus } =
    draftState
  const latestDocIdRef = useRef(savedDraft.docId || activePage?.docId || '')
  const [retryAt, setRetryAt] = useState(0)
  const [snapshotStatus, setSnapshotStatus] = useState<TDraftSnapshotStatus>({
    creating: false,
    lastCreatedSignature: draftState.savedDraft.revisionSignature,
  })

  useEffect(() => {
    latestDocIdRef.current = savedDraft.docId || activePage?.docId || ''
  }, [activePage?.docId, savedDraft.docId])

  useEffect(() => {
    setRetryAt(0)
  }, [activePage?.docId, savedDraft.revisionSignature])

  useEffect(() => {
    if (saveStatus.lastSavedAt !== null) return

    setSnapshotStatus({
      creating: false,
      lastCreatedSignature: savedDraft.revisionSignature,
    })
  }, [savedDraft.docId, savedDraft.revisionSignature, saveStatus.lastSavedAt])

  useEffect(() => {
    if (
      !activePage?.docId ||
      draftSource !== 'draft' ||
      !editable ||
      invalid ||
      loadStatus.loading ||
      saveStatus.lastSavedAt === null ||
      saveStatus.saving ||
      savedDraft.revisionSignature === snapshotStatus.lastCreatedSignature ||
      snapshotStatus.creating
    ) {
      return
    }

    const elapsed = saveStatus.lastSavedAt ? Date.now() - saveStatus.lastSavedAt : 0
    const delay = Math.max(DOC_DRAFT_REVISION_CHECKPOINT_DELAY - elapsed, retryAt - Date.now(), 0)
    const signature = savedDraft.revisionSignature
    const docId = savedDraft.docId || activePage.docId
    const timer = window.setTimeout(() => {
      if (latestDocIdRef.current !== docId) return

      setSnapshotStatus((current) => ({ ...current, creating: true }))

      mutate(S.checkpointDocDraftSnapshot, { community, id: docId })
        .then(() => {
          if (latestDocIdRef.current !== docId) return

          setSnapshotStatus({ creating: false, lastCreatedSignature: signature })
          setRetryAt(0)
          send(DSB_DOC_EVENT.REVISION_RELOAD)
        })
        .catch((err) => {
          if (latestDocIdRef.current !== docId) return

          const message =
            err instanceof Error ? err.message : t(REVISION_LABEL_KEY.CHECKPOINT_FAILED)
          setRetryAt(Date.now() + DOC_DRAFT_REVISION_CHECKPOINT_DELAY)
          setSnapshotStatus((current) => ({ ...current, creating: false }))
          toast(message, 'error')
        })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [
    activePage?.docId,
    community,
    draftSource,
    editable,
    invalid,
    loadStatus.loading,
    mutate,
    savedDraft.docId,
    savedDraft.revisionSignature,
    retryAt,
    saveStatus.lastSavedAt,
    saveStatus.saving,
    snapshotStatus.creating,
    snapshotStatus.lastCreatedSignature,
    t,
  ])
}
