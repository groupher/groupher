import type { TRichEditorValue } from '@groupher/rich-editor'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { slugify } from '~/lib/slug'

import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import { findChild } from '../SideTree/helper'
import type { TSideTreeController } from '../SideTree/spec'
import useDocsEditor from '../store/hooks'
import {
  composeEditorDraft,
  composeEditorDraftFromSession,
  composeEditorDraftMeta,
  composeEmptyEditorDraft,
  composeEmptySavedDraft,
  composeSavedDraft,
  isDraftDirty,
  countEditorText,
} from './helper'
import type {
  TDraftLoadStatus,
  TDraftSaveStatus,
  TDocDraftDTO,
  TDocDraftSession,
  TEditorDraft,
  TEditorDraftMeta,
  TSavedDraft,
} from './spec'

type TApplySavedParams = {
  meta: TEditorDraftMeta
  requestDraft: TEditorDraft
  savedDraft: TDocDraftDTO | null | undefined
  startedDraft: TEditorDraft
}

export type TDraftEditorState = {
  activePage: ReturnType<typeof resolveActivePage>
  bodyStats: ReturnType<typeof countEditorText>
  dirty: boolean
  draft: TEditorDraft
  editable: boolean
  invalid: boolean
  loadStatus: TDraftLoadStatus
  meta: TEditorDraftMeta
  savedDraft: TSavedDraft
  saveStatus: TDraftSaveStatus
  applyDraftPatch: (patch: Partial<TEditorDraftMeta>) => void
  applyLoaded: (session: TDocDraftSession) => void
  applySaved: (params: TApplySavedParams) => void
  clearSaveError: () => void
  editBodyValue: (value: TRichEditorValue) => void
  editSubtitle: (value: string) => void
  editTitle: (value: string) => void
  resetDraft: () => void
  setDraftSlug: (slug: string) => void
  setLoadError: (error: string) => void
  setLoading: () => void
  setSaveError: (error: string) => void
  setSaving: () => void
}

const resolveActivePage = (sideTree: TSideTreeController) => {
  const activeChild = sideTree.activeId ? findChild(sideTree.groups, sideTree.activeId) : null
  return activeChild?.type === SIDE_TREE_NODE_TYPE.PAGE && activeChild.docId ? activeChild : null
}

export default function useDraftEditorState(sideTree: TSideTreeController): TDraftEditorState {
  const { live$: docsEditor$ } = useDocsEditor()
  const initialDraft = useMemo(
    () =>
      composeEditorDraft({
        bodyValue: docsEditor$.bodyValue,
        docId: docsEditor$.docDraftInfo.id || '',
        slug: docsEditor$.docDraftInfo.slug,
        subtitle: docsEditor$.docDraftInfo.subtitle,
        title: docsEditor$.docDraftInfo.title,
      }),
    [],
  )
  const activePage = useMemo(
    () => resolveActivePage(sideTree),
    [sideTree.activeId, sideTree.groups],
  )
  const [draft, setDraft] = useState<TEditorDraft>(initialDraft)
  const [savedDraft, setSavedDraft] = useState<TSavedDraft>(() => composeSavedDraft(initialDraft))
  const [meta, setMeta] = useState<TEditorDraftMeta>(() =>
    composeEditorDraftMeta(docsEditor$.docDraftInfo),
  )
  const [loadStatus, setLoadStatus] = useState<TDraftLoadStatus>({
    error: null,
    loadedDocId: initialDraft.docId || null,
    loading: false,
  })
  const [saveStatus, setSaveStatus] = useState<TDraftSaveStatus>({
    error: null,
    lastSavedAt: null,
    saving: false,
  })

  const bodyStats = useMemo(() => countEditorText(draft.bodyValue), [draft.bodyValue])
  const dirty = isDraftDirty(draft, savedDraft)
  const editable = !!activePage?.docId
  const invalid = !draft.title.trim()

  const resetDraft = useCallback((): void => {
    const emptyDraft = composeEmptyEditorDraft()
    const emptySavedDraft = composeEmptySavedDraft()

    setDraft(emptyDraft)
    setSavedDraft(emptySavedDraft)
    setMeta(composeEditorDraftMeta())
    setLoadStatus({ error: null, loadedDocId: null, loading: false })
    setSaveStatus({ error: null, lastSavedAt: null, saving: false })
  }, [])

  const applyLoaded = useCallback((session: TDocDraftSession): void => {
    const nextDraft = composeEditorDraftFromSession(session)

    setDraft(nextDraft)
    setSavedDraft(composeSavedDraft(nextDraft))
    setMeta(composeEditorDraftMeta(session.info))
    setLoadStatus({ error: null, loadedDocId: nextDraft.docId || null, loading: false })
    setSaveStatus({ error: null, lastSavedAt: null, saving: false })
  }, [])

  const applySaved = useCallback(
    ({
      meta: nextMeta,
      requestDraft,
      savedDraft: savedDraftDTO,
      startedDraft,
    }: TApplySavedParams) => {
      const nextSavedDraft = composeSavedDraft(requestDraft)

      setSavedDraft(nextSavedDraft)
      setMeta(nextMeta)
      setDraft((current) => {
        const title = current.title === startedDraft.title ? requestDraft.title : current.title
        const subtitle =
          current.subtitle === startedDraft.subtitle ? requestDraft.subtitle : current.subtitle
        const slug = current.slug === startedDraft.slug ? requestDraft.slug : current.slug
        const bodyValue =
          current.bodyJson === startedDraft.bodyJson ? requestDraft.bodyValue : current.bodyValue

        return composeEditorDraft({
          bodyValue,
          docId: current.docId || savedDraftDTO?.docId || requestDraft.docId,
          slug,
          subtitle,
          title,
        })
      })
      setSaveStatus({ error: null, lastSavedAt: Date.now(), saving: false })
    },
    [],
  )

  const updateDraft = useCallback((patch: Partial<Omit<TEditorDraft, 'bodyJson'>>): void => {
    setDraft((current) => composeEditorDraft({ ...current, ...patch }))
  }, [])

  const editTitle = useCallback((title: string): void => updateDraft({ title }), [updateDraft])
  const editSubtitle = useCallback(
    (subtitle: string): void => updateDraft({ subtitle }),
    [updateDraft],
  )
  const editBodyValue = useCallback(
    (bodyValue: TRichEditorValue): void => updateDraft({ bodyValue }),
    [updateDraft],
  )
  const setDraftSlug = useCallback((slug: string): void => updateDraft({ slug }), [updateDraft])

  useEffect(() => {
    const trimmedTitle = draft.title.trim()
    if (!activePage || !trimmedTitle) {
      setDraftSlug('')
      return
    }

    let canceled = false

    const timer = window.setTimeout(() => {
      slugify(trimmedTitle)
        .then((slug) => {
          if (!canceled) setDraftSlug(slug)
        })
        .catch(() => {
          if (!canceled) setDraftSlug('')
        })
    }, 260)

    return () => {
      canceled = true
      window.clearTimeout(timer)
    }
  }, [activePage, draft.title, setDraftSlug])

  const setLoading = useCallback((): void => {
    setLoadStatus((current) => ({ ...current, error: null, loading: true }))
    setSaveStatus((current) => ({ ...current, error: null }))
  }, [])

  const setLoadError = useCallback((error: string): void => {
    setLoadStatus((current) => ({ ...current, error, loading: false }))
  }, [])

  const setSaving = useCallback((): void => {
    setSaveStatus((current) => ({ ...current, error: null, saving: true }))
  }, [])

  const setSaveError = useCallback((error: string): void => {
    setSaveStatus((current) => ({ ...current, error, saving: false }))
  }, [])

  const clearSaveError = useCallback((): void => {
    setSaveStatus((current) => ({ ...current, error: null }))
  }, [])

  const applyDraftPatch = useCallback((patch: Partial<TEditorDraftMeta>): void => {
    setMeta((current) => composeEditorDraftMeta({ ...current, ...patch }))
    setSaveStatus((current) => ({ ...current, error: null, saving: false }))
  }, [])

  return {
    activePage,
    bodyStats,
    dirty,
    draft,
    editable,
    invalid,
    loadStatus,
    meta,
    savedDraft,
    saveStatus,
    applyDraftPatch,
    applyLoaded,
    applySaved,
    clearSaveError,
    editBodyValue,
    editSubtitle,
    editTitle,
    resetDraft,
    setDraftSlug,
    setLoadError,
    setLoading,
    setSaveError,
    setSaving,
  }
}
