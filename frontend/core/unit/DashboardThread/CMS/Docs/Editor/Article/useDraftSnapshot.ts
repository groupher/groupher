import { useEffect, useRef, useState } from 'react'

import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import { send } from '~/lib/signal'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'
import { toast } from '~/widgets/Toaster'

import { REVISION_LABEL_KEY } from '../../ActionSnackbar/constant'
import { DOC_DRAFT_REVISION_CHECKPOINT_DELAY } from './constant'
import type { TDraftSnapshotStatus } from './spec'
import type { TDraftEditorState } from './useDraftEditorState'

export default function useDraftSnapshot(draftState: TDraftEditorState): void {
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()
  const snapshotInFlightRef = useRef(false)
  const [snapshotStatus, setSnapshotStatus] = useState<TDraftSnapshotStatus>({
    creating: false,
    lastCreatedSignature: draftState.savedDraft.revisionSignature,
  })

  const { activePage, editable, invalid, loadStatus, savedDraft, saveStatus } = draftState

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
      !editable ||
      invalid ||
      loadStatus.loading ||
      saveStatus.lastSavedAt === null ||
      saveStatus.saving ||
      savedDraft.revisionSignature === snapshotStatus.lastCreatedSignature ||
      snapshotInFlightRef.current
    ) {
      return
    }

    const elapsed = saveStatus.lastSavedAt ? Date.now() - saveStatus.lastSavedAt : 0
    const delay = Math.max(DOC_DRAFT_REVISION_CHECKPOINT_DELAY - elapsed, 0)
    const signature = savedDraft.revisionSignature
    const docId = savedDraft.docId || activePage.docId

    const timer = window.setTimeout(() => {
      snapshotInFlightRef.current = true
      setSnapshotStatus((current) => ({ ...current, creating: true }))

      mutate(S.checkpointDocDraftSnapshot, { community, id: docId })
        .then(() => {
          setSnapshotStatus({ creating: false, lastCreatedSignature: signature })
          send(DSB_DOC_EVENT.REVISION_RELOAD)
        })
        .catch((err) => {
          const message =
            err instanceof Error ? err.message : t(REVISION_LABEL_KEY.CHECKPOINT_FAILED)
          setSnapshotStatus((current) => ({ ...current, creating: false }))
          toast(message, 'error')
        })
        .finally(() => {
          snapshotInFlightRef.current = false
        })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [
    activePage?.docId,
    community,
    editable,
    invalid,
    loadStatus.loading,
    mutate,
    savedDraft.docId,
    savedDraft.revisionSignature,
    saveStatus.lastSavedAt,
    saveStatus.saving,
    snapshotStatus.lastCreatedSignature,
    t,
  ])
}
