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

import useDocsEditorCommands from '../../commands/hooks'
import { reloadDocsPublishQueue } from '../../helper'
import type { TSideTreeChild } from '../../SideTree/spec'
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
  const { registerSaveDocDraft } = useDocsEditorCommands()
  const failedAutoSaveDraftRef = useRef<TDraftEditorState['draft'] | null>(null)
  const pendingSaveRef = useRef<{
    startedDraft: TDraftEditorState['draft']
    unknown: boolean
    requestDraft: ReturnType<typeof composeEditorDraft>
    variables: TSaveDocWorkingCopyInput
  } | null>(null)
  const conflictPausedRef = useRef(false)
  const saveInFlightRef = useRef(false)
  const rateLimitUntilRef = useRef(0)
  const rateLimitTimerRef = useRef<number | null>(null)
  const latestSaveRef = useRef<() => Promise<void>>(async () => undefined)
  const latestDocIdRef = useRef(draftState.draft.docId)
  const latestCopyIdRef = useRef(draftState.workingCopyId)
  const latestDraftRef = useRef(draftState.draft)
  useLayoutEffect(() => {
    latestCopyIdRef.current = draftState.workingCopyId
    latestDraftRef.current = draftState.draft
  }, [draftState.workingCopyId, draftState.draft])

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
      pendingSaveRef.current = null
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

    if (
      pendingSaveRef.current &&
      (pendingSaveRef.current.variables.articleId !== activePage.docId ||
        pendingSaveRef.current.variables.workingCopyId !== workingCopyId ||
        pendingSaveRef.current.variables.community !== community)
    )
      pendingSaveRef.current = null

    const startedDraft = pendingSaveRef.current?.startedDraft ?? draft
    conflictPausedRef.current = false
    const requestDocId = startedDraft.docId || activePage.docId
    const nextTitle = startedDraft.title.trim()
    const nextSubtitle = startedDraft.subtitle.trim()

    saveInFlightRef.current = true
    setSaving()

    try {
      if (!pendingSaveRef.current) {
        const nextSlug = await slugify(nextTitle)
        const requestDraft = composeEditorDraft({
          bodyValue: startedDraft.bodyValue,
          docId: requestDocId,
          slug: nextSlug,
          subtitle: nextSubtitle,
          title: nextTitle,
        })
        const input = composeDraftSaveInput(requestDraft, nextSlug)
        pendingSaveRef.current = {
          startedDraft,
          unknown: false,
          requestDraft,
          variables: {
            value: input.value,
            community,
            articleId: input.id,
            workingCopyId,
            slug: input.slug,
            subtitle: input.subtitle,
            title: input.title,
            revision: startedDraft.version,
            commandId: createCommandHandle({ docId: requestDocId }).commandId,
          },
        }
      }

      const pending = pendingSaveRef.current
      const executeSave = () =>
        executeCommand({
          request: (variables: TSaveDocWorkingCopyInput) =>
            saveDocWorkingCopy<TDocWorkingCopy>(variables),
          variables: pending.variables,
          commandId: pending.variables.commandId,
        })
      let savedDraft: TDocWorkingCopy
      try {
        savedDraft = await executeSave()
      } catch (error) {
        if (!(error instanceof ContentPublishError) || error.code !== 'transport_unknown')
          throw error
        pending.unknown = true
        savedDraft = await executeSave()
      }
      pendingSaveRef.current = null
      const requestDraft = pending.requestDraft
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
      if (err instanceof ContentPublishError && err.code === 'transport_unknown') {
        if (pendingSaveRef.current) pendingSaveRef.current.unknown = true
      } else if (
        !pendingSaveRef.current?.unknown ||
        (err instanceof ContentPublishError &&
          [
            'command_id_conflict',
            'command_result_unavailable',
            'command_result_expired',
            'revision_conflict',
          ].includes(err.code))
      ) {
        pendingSaveRef.current = null
      }
      if (
        err instanceof ContentPublishError &&
        ['revision_conflict', 'command_result_unavailable', 'command_result_expired'].includes(
          err.code,
        )
      ) {
        conflictPausedRef.current = true
        let data: { articleWorkingCopies: TDocWorkingCopy[] }
        try {
          data = await browserGraphQLRequest<{ articleWorkingCopies: TDocWorkingCopy[] }>(
            S.docsWorkingCopies,
            {
              community,
              articleId: requestDocId,
            },
          )
        } catch {
          if (latestDocIdRef.current !== requestDocId || latestCopyIdRef.current !== workingCopyId)
            return
          const message = 'The server draft could not be reloaded. Your local edits were preserved.'
          setSaveError(message)
          toast(message, 'error')
          return
        }
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
      failedAutoSaveDraftRef.current = latestDraftRef.current
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

  useEffect(() => registerSaveDocDraft(save), [registerSaveDocDraft, save])

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
