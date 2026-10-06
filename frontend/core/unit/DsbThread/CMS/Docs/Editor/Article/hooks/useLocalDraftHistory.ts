/**
 * Coordinates Doc editor state with the shared best-effort local recovery store.
 *
 *   editor changes -> throttled Working Copy -> periodic Recovery Point
 *   server Draft   -> conflict inspection   -> explicit user restore
 */

import type { TRichEditorValue } from '@groupher/rich-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  localDraftRepository,
  type TLocalDraftAvailability,
  type TLocalDraftInspection,
  type TLocalDraftRecoveryPoint,
  type TLocalDraftWorkspaceIdentity,
} from '~/lib/localDraftHistory'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'

import { DOC_DRAFT_REVISION_CHECKPOINT_DELAY } from '../constant'
import { toDocLocalDraftPayload } from '../localDraftAdapter'
import type { TDraftEditorState } from './useDraftEditorState'

const WORKING_COPY_DELAY = 3_000

export type TLocalDraftHistoryController = {
  availability: TLocalDraftAvailability
  inspection: TLocalDraftInspection
  recoveryPoints: TLocalDraftRecoveryPoint[]
  dismiss: () => void
  discardWorkingCopy: () => Promise<void>
  restoreRecoveryPoint: (point: TLocalDraftRecoveryPoint) => void
  restoreWorkingCopy: () => void
}

const emptyInspection: TLocalDraftInspection = { status: 'none' }

/** Exposes LocalDraftHistory state and explicit recovery actions to the Doc editor UI. */
export default function useLocalDraftHistory(
  draftState: TDraftEditorState,
): TLocalDraftHistoryController {
  const { accountRef } = useAccount()
  const { slug: communityId } = useCommunity()
  const repository = localDraftRepository
  const writerSessionId = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
  )
  const [inspection, setInspection] = useState<TLocalDraftInspection>(emptyInspection)
  const [recoveryPoints, setRecoveryPoints] = useState<TLocalDraftRecoveryPoint[]>([])
  const [availability, setAvailability] = useState<TLocalDraftAvailability>(
    repository.getAvailability(),
  )

  const identity = useMemo<TLocalDraftWorkspaceIdentity | null>(() => {
    const articleId = draftState.draft.docId || draftState.activePage?.docId
    if (!accountRef || !articleId) return null
    return {
      accountId: accountRef,
      communityId,
      thread: 'doc',
      articleId,
      branchId: 'main',
    }
  }, [accountRef, communityId, draftState.activePage?.docId, draftState.draft.docId])

  const writeInput = useCallback(() => {
    if (!identity) return null
    return {
      ...identity,
      baseRevisionId: draftState.savedDraft.baseRevisionId,
      baseServerDraftVersion: draftState.savedDraft.version,
      baseServerContentHash: draftState.savedDraft.serverContentHash,
      payload: toDocLocalDraftPayload(draftState),
      writerSessionId: writerSessionId.current,
    }
  }, [draftState, identity])

  const applyPayload = useCallback(
    (payload: TLocalDraftRecoveryPoint['payload']): void => {
      draftState.editTitle(payload.title)
      draftState.editSubtitle(String(payload.fields?.subtitle || ''))
      draftState.setDraftSlug(payload.slug || '')
      draftState.editBodyValue(payload.body as TRichEditorValue)
      setInspection(emptyInspection)
    },
    [draftState],
  )

  useEffect(() => {
    if (!identity || draftState.loadStatus.loading || !draftState.loadStatus.loadedDocId) return
    let cancelled = false
    void Promise.all([
      repository.inspectWorkingCopy(identity, draftState.savedDraft.serverContentHash),
      repository.listRecoveryPoints(identity),
    ]).then(([nextInspection, points]) => {
      if (cancelled) return
      if (nextInspection.status === 'synced') {
        void repository.deleteWorkingCopy(identity)
        setInspection(emptyInspection)
      } else {
        setInspection(nextInspection)
      }
      setRecoveryPoints(points)
      setAvailability(repository.getAvailability())
    })
    return () => {
      cancelled = true
    }
  }, [
    draftState.loadStatus.loadedDocId,
    draftState.loadStatus.loading,
    draftState.savedDraft.serverContentHash,
    identity,
    repository,
  ])

  useEffect(() => {
    if (!identity || !draftState.dirty) return
    const timer = window.setTimeout(() => {
      const input = writeInput()
      if (!input) return
      void repository
        .writeWorkingCopy(input)
        .then(() => setAvailability(repository.getAvailability()))
    }, WORKING_COPY_DELAY)
    return () => window.clearTimeout(timer)
  }, [draftState.dirty, draftState.draft, identity, repository, writeInput])

  useEffect(() => {
    if (!identity || !draftState.dirty) return
    const timer = window.setTimeout(() => {
      const input = writeInput()
      if (!input) return
      void repository.appendRecoveryPoint(input).then(async (stored) => {
        setAvailability(repository.getAvailability())
        if (!stored) return
        const points = await repository.listRecoveryPoints(identity)
        setRecoveryPoints(points)
      })
    }, DOC_DRAFT_REVISION_CHECKPOINT_DELAY)
    return () => window.clearTimeout(timer)
  }, [draftState.dirty, draftState.draft, identity, repository, writeInput])

  useEffect(() => {
    if (!identity || draftState.saveStatus.lastSavedAt === null) return
    if (!draftState.dirty) {
      void repository.deleteWorkingCopy(identity)
      return
    }
    const input = writeInput()
    if (input) void repository.writeWorkingCopy(input)
  }, [draftState.dirty, draftState.saveStatus.lastSavedAt, identity, repository, writeInput])

  useEffect(() => {
    if (!identity) return
    const channelName = `groupher-local-draft:${encodeURIComponent(identity.articleId)}`
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(channelName)
    channel.onmessage = (event: MessageEvent<{ writerSessionId?: string }>) => {
      if (event.data.writerSessionId && event.data.writerSessionId !== writerSessionId.current) {
        toast('This draft is also open in another tab.', 'info')
      }
    }
    channel.postMessage({ writerSessionId: writerSessionId.current })
    return () => channel.close()
  }, [identity])

  useEffect(() => {
    if (!identity) return
    const flush = (): void => {
      if (!draftState.dirty) return
      const input = writeInput()
      if (input) void repository.writeWorkingCopy(input)
    }
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
    }
  }, [draftState.dirty, identity, repository, writeInput])

  const discardWorkingCopy = useCallback(async (): Promise<void> => {
    if (!identity) return
    await repository.deleteWorkingCopy(identity)
    setInspection(emptyInspection)
  }, [identity, repository])

  return {
    availability,
    inspection,
    recoveryPoints,
    dismiss: () => setInspection(emptyInspection),
    discardWorkingCopy,
    restoreRecoveryPoint: (point) => applyPayload(point.payload),
    restoreWorkingCopy: () => {
      if (inspection.status !== 'none') applyPayload(inspection.workingCopy.payload)
    },
  }
}
