import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

import { ARTICLE_STAGE } from '~/const/article'
import { browserGraphQLRequest } from '~/graphql/client'
import { saveDocWorkingCopy, type TSaveDocWorkingCopyInput } from '~/lib/artimentPublisher'
import { ContentPublishError } from '~/lib/contentPublisher'
import { slugify } from '~/lib/slug'
import { createCommandHandle, executeCommand } from '~/query/mutation/optimistic/execute'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DsbThread/schema/docs'

import { reloadDocsPublishQueue } from '../../helper'
import type { TSideTreeChild } from '../../SideTree/spec'
import useDocsEditor from '../../store/hooks'
import { DOC_AUTO_SAVE_DELAY } from '../constant'
import {
  composeDraftPublishState,
  composeDraftSaveInput,
  composeEditorDraft,
  composeEditorDraftMeta,
  composeWorkingCopySession,
} from '../helper'
import type { TDocWorkingCopy } from '../spec'
import type { TDraftEditorState } from './useDraftEditorState'

type TParams = {
  patchSideTreeChild: (childId: string, patch: Partial<TSideTreeChild>) => void
}

/** Exposes draft auto save state and actions through the shared React hook boundary. */
export default function useDraftAutoSave(
  draftState: TDraftEditorState,
  { patchSideTreeChild }: TParams,
) {
  const { slug: community } = useCommunity()
  const { attachSaveDocDraft } = useDocsEditor()
  const failedAutoSaveDraftRef = useRef<TDraftEditorState['draft'] | null>(null)
  const conflictPausedRef = useRef(false)
  const saveInFlightRef = useRef(false)
  const rateLimitUntilRef = useRef(0)
  const rateLimitTimerRef = useRef<number | null>(null)
  const latestSaveRef = useRef<() => Promise<void>>(async () => undefined)
  const latestDocIdRef = useRef(draftState.draft.docId)
  const latestCopyIdRef = useRef(draftState.workingCopyId)
  useLayoutEffect(() => {
    latestCopyIdRef.current = draftState.workingCopyId
  }, [draftState.workingCopyId])

  const {
    workingCopyId,
    activePage,
    applySaved,
    reconcileConflict,
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
    if (latestDocIdRef.current !== draft.docId) {
      if (rateLimitTimerRef.current !== null) window.clearTimeout(rateLimitTimerRef.current)
      rateLimitTimerRef.current = null
      rateLimitUntilRef.current = 0
      failedAutoSaveDraftRef.current = null
      conflictPausedRef.current = false
    }
    latestDocIdRef.current = draft.docId
  }, [draft.docId])

  const save = useCallback(async (): Promise<void> => {
    if (
      !activePage?.docId ||
      !workingCopyId ||
      !editable ||
      invalid ||
      loadStatus.loading ||
      saveInFlightRef.current ||
      Date.now() < rateLimitUntilRef.current
    )
      return

    const startedDraft = draft
    conflictPausedRef.current = false
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
      const command = createCommandHandle({ docId: requestDocId })
      const executeSave = () =>
        executeCommand({
          request: (variables: TSaveDocWorkingCopyInput) =>
            saveDocWorkingCopy<TDocWorkingCopy>(variables),
          variables: {
            value: input.value,
            community,
            articleId: input.id,
            workingCopyId: workingCopyId!,
            slug: input.slug,
            subtitle: input.subtitle,
            title: input.title,
            revision: startedDraft.version,
          },
          commandId: command.commandId,
        })
      let savedDraft: TDocWorkingCopy
      try {
        savedDraft = await executeSave()
      } catch (error) {
        if (!(error instanceof ContentPublishError) || error.code !== 'transport_unknown')
          throw error
        savedDraft = await executeSave()
      }
      failedAutoSaveDraftRef.current = null
      if (rateLimitTimerRef.current !== null) window.clearTimeout(rateLimitTimerRef.current)
      rateLimitTimerRef.current = null
      rateLimitUntilRef.current = 0
      const publishState = composeDraftPublishState(activePage.publishState)

      if (latestDocIdRef.current !== requestDocId || latestCopyIdRef.current !== workingCopyId)
        return

      patchSideTreeChild(activePage.id, { publishState })
      applySaved({
        meta: composeEditorDraftMeta({
          author: null,
          insertedAt: savedDraft?.insertedAt ?? null,
          stage: ARTICLE_STAGE.DRAFT,
          updatedAt: savedDraft?.updatedAt ?? new Date().toISOString(),
        }),
        requestDraft: {
          ...requestDraft,
          docId: savedDraft.articleId || requestDraft.docId,
          slug: savedDraft?.slug || requestDraft.slug,
        },
        savedDraft,
        startedDraft,
      })
      reloadDocsPublishQueue()
    } catch (err) {
      if (latestDocIdRef.current !== requestDocId || latestCopyIdRef.current !== workingCopyId)
        return

      const message = err instanceof Error ? err.message : String(err)
      if (err instanceof ContentPublishError && err.code === 'revision_conflict') {
        conflictPausedRef.current = true
        const data = await browserGraphQLRequest<{ articleWorkingCopies: TDocWorkingCopy[] }>(
          S.docsWorkingCopies,
          {
            community,
            articleId: requestDocId,
          },
        )
        if (latestDocIdRef.current !== requestDocId || latestCopyIdRef.current !== workingCopyId)
          return
        const copy = data.articleWorkingCopies.find((item) => item.scopeType === 'default')
        if (!copy || copy.id !== workingCopyId) {
          setSaveError('This editing session has ended. Your local edits were preserved.')
          toast('This editing session has ended. Your local edits were preserved.', 'error')
          return
        }
        reconcileConflict(composeWorkingCopySession(copy, activePage))
        toast('The server draft changed. Your local edits were preserved.', 'error')
        return
      }
      if (err instanceof ContentPublishError && err.status === 429) {
        const retrySeconds = Number.isFinite(err.retryAfter) ? Math.max(1, err.retryAfter || 1) : 1
        rateLimitUntilRef.current = Date.now() + retrySeconds * 1000
        if (rateLimitTimerRef.current !== null) window.clearTimeout(rateLimitTimerRef.current)
        rateLimitTimerRef.current = window.setTimeout(() => {
          rateLimitTimerRef.current = null
          rateLimitUntilRef.current = 0
          failedAutoSaveDraftRef.current = null
          void latestSaveRef.current()
        }, retrySeconds * 1000)
      }
      failedAutoSaveDraftRef.current = startedDraft
      setSaveError(message)
      toast(message, 'error')
    } finally {
      saveInFlightRef.current = false
    }
  }, [
    activePage,
    workingCopyId,
    applySaved,
    community,
    draft,
    editable,
    invalid,
    loadStatus.loading,
    patchSideTreeChild,
    reconcileConflict,
    setSaveError,
    setSaving,
  ])

  latestSaveRef.current = save

  useEffect(
    () => () => {
      if (rateLimitTimerRef.current !== null) window.clearTimeout(rateLimitTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    attachSaveDocDraft(save)

    return () => attachSaveDocDraft(null)
  }, [attachSaveDocDraft, save])

  useEffect(() => {
    if (!dirty || !editable || invalid || loadStatus.loading || saveStatus.saving) return
    if (conflictPausedRef.current) return
    if (failedAutoSaveDraftRef.current === draft) return

    const timer = window.setTimeout(() => {
      save()
    }, DOC_AUTO_SAVE_DELAY)

    return () => window.clearTimeout(timer)
  }, [dirty, draft, editable, invalid, loadStatus.loading, save, saveStatus.saving])

  return { save }
}
