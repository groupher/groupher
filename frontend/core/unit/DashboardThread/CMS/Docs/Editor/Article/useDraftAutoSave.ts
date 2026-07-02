import { useCallback, useEffect, useRef } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import { slugify } from '~/lib/slug'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'
import { toast } from '~/widgets/Toaster'

import { reloadDocPublishScope } from '../helper'
import type { TSideTreeChild } from '../SideTree/spec'
import useDocsEditor from '../store/hooks'
import { DOC_AUTO_SAVE_DELAY } from './constant'
import {
  composeDraftPublishState,
  composeDraftSaveInput,
  composeEditorDraft,
  composeEditorDraftMeta,
} from './helper'
import type { TDocDraftDTO } from './spec'
import type { TDraftEditorState } from './useDraftEditorState'

type TParams = {
  patchSideTreeChild: (childId: string, patch: Partial<TSideTreeChild>) => void
}

export default function useDraftAutoSave(
  draftState: TDraftEditorState,
  { patchSideTreeChild }: TParams,
) {
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()
  const { attachSaveDocDraft } = useDocsEditor()
  const saveInFlightRef = useRef(false)
  const latestDocIdRef = useRef(draftState.draft.docId)

  const {
    activePage,
    applySaved,
    dirty,
    draft,
    editable,
    invalid,
    loadStatus,
    saveStatus,
    setSaveError,
    setSaving,
  } = draftState

  useEffect(() => {
    latestDocIdRef.current = draft.docId
  }, [draft.docId])

  const save = useCallback(async (): Promise<void> => {
    if (!activePage?.docId || invalid || saveInFlightRef.current) return

    const startedDraft = draft
    const requestDocId = startedDraft.docId || activePage.docId
    const nextTitle = startedDraft.title.trim()
    const nextSubtitle = startedDraft.subtitle.trim()

    saveInFlightRef.current = true
    setSaving()

    try {
      const nextSlug = await slugify(nextTitle)
      const requestDraft = composeEditorDraft({
        bodyValue: startedDraft.bodyValue,
        docId: requestDocId,
        slug: nextSlug,
        subtitle: nextSubtitle,
        title: nextTitle,
      })
      const input = composeDraftSaveInput(requestDraft, nextSlug)
      const data = await mutate<{ updateDocDraft?: TDocDraftDTO }>(S.updateDocDraft, {
        body: input.body,
        community,
        id: input.id,
        slug: input.slug,
        subtitle: input.subtitle,
        title: input.title,
      })
      const savedDraft = data?.updateDocDraft
      const publishState = composeDraftPublishState(activePage.publishState)

      if (latestDocIdRef.current !== requestDocId) return

      patchSideTreeChild(activePage.id, { publishState })
      applySaved({
        meta: composeEditorDraftMeta({
          author: savedDraft?.author ?? null,
          insertedAt: savedDraft?.insertedAt ?? null,
          stage: savedDraft?.stage ?? null,
          updatedAt: savedDraft?.updatedAt ?? new Date().toISOString(),
        }),
        requestDraft: {
          ...requestDraft,
          docId: savedDraft?.docId || requestDraft.docId,
          slug: savedDraft?.slug || requestDraft.slug,
        },
        savedDraft,
        startedDraft,
      })
      reloadDocPublishScope()
    } catch (err) {
      if (latestDocIdRef.current !== requestDocId) return

      const message = err instanceof Error ? err.message : String(err)
      setSaveError(message)
      toast(message, 'error')
    } finally {
      saveInFlightRef.current = false
    }
  }, [
    activePage,
    applySaved,
    community,
    draft,
    invalid,
    mutate,
    patchSideTreeChild,
    setSaveError,
    setSaving,
  ])

  useEffect(() => {
    attachSaveDocDraft(save)

    return () => attachSaveDocDraft(null)
  }, [attachSaveDocDraft, save])

  useEffect(() => {
    if (!dirty || !editable || invalid || loadStatus.loading || saveStatus.saving) return

    const timer = window.setTimeout(() => {
      save()
    }, DOC_AUTO_SAVE_DELAY)

    return () => window.clearTimeout(timer)
  }, [dirty, editable, invalid, loadStatus.loading, save, saveStatus.saving])

  return { save }
}
