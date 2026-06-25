import type { TRichEditorValue } from '@groupher/rich-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import { slugify } from '~/lib/slug'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'
import { toast } from '~/widgets/Toaster'

import { REVISION_LABEL_KEY } from '../../ActionSnackbar/constant'
import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import { findChild } from '../SideTree/helper'
import type { TSideTreeController } from '../SideTree/spec'
import useDocsEditor from '../store/hooks'
import {
  DOC_AUTO_SAVE_DELAY,
  DOC_DRAFT_REVISION_CHECKPOINT_DELAY,
  EMPTY_EDITOR_VALUE,
} from './constant'
import { countEditorText, resolveDraftSession, serializeEditorValue } from './helper'
import type { TDocDraftDTO, TDocDraftInitialData } from './spec'

const revisionSignature = (bodyJson: string, subtitle: string): string => `${subtitle}\n${bodyJson}`

/**
 * Own the active doc draft editing lifecycle for the Article editor.
 *
 * @example
 * const editor = useLogic(sideTree, initialDraft)
 * editor.setTitle('New title')
 */
export default function useLogic(
  sideTree: TSideTreeController,
  initialDraft?: TDocDraftInitialData | null,
) {
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const {
    attachSaveDocDraft,
    live$: docsEditor$,
    revisionReloadKey,
    setDocDraftSession,
  } = useDocsEditor()
  const { query, mutate } = useGraphQLClient()
  const activePage = useMemo(() => {
    const child = sideTree.activeId ? findChild(sideTree.groups, sideTree.activeId) : null

    return child?.type === SIDE_TREE_NODE_TYPE.PAGE && child.docId ? child : null
  }, [sideTree.activeId, sideTree.groups])
  const initialSession =
    initialDraft && activePage?.docId === initialDraft.id
      ? resolveDraftSession(initialDraft, activePage)
      : null
  const [title, setTitle] = useState(initialSession?.title ?? '')
  const [subtitle, setSubtitle] = useState(initialSession?.subtitle ?? '')
  const [bodyValue, setBodyValue] = useState<TRichEditorValue>(
    initialSession?.body ?? EMPTY_EDITOR_VALUE,
  )
  const [slug, setSlug] = useState(initialSession?.slug ?? '')
  const [loadedDocId, setLoadedDocId] = useState<string | null>(initialSession?.info.id ?? null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadIdRef = useRef(0)
  const bodyValueRef = useRef<TRichEditorValue>(EMPTY_EDITOR_VALUE)
  const savedTitleRef = useRef(initialSession?.title ?? '')
  const savedSubtitleRef = useRef(initialSession?.subtitle ?? '')
  const savedBodyRef = useRef(initialSession?.bodyJson ?? serializeEditorValue(EMPTY_EDITOR_VALUE))
  const savingRef = useRef(false)
  const checkpointingRef = useRef(false)
  const pendingRevisionCheckpointRef = useRef(false)
  const lastAutosavedAtRef = useRef(Date.now())
  const lastCheckpointedSignatureRef = useRef(
    revisionSignature(
      initialSession?.bodyJson ?? serializeEditorValue(EMPTY_EDITOR_VALUE),
      initialSession?.subtitle ?? '',
    ),
  )
  const lastLoadedDocIdRef = useRef<string | null>(initialSession?.info.id ?? null)
  const initialDraftConsumedRef = useRef(false)
  const slugTitleRef = useRef('')
  const titleRef = useRef('')
  const subtitleRef = useRef('')

  useEffect(() => {
    titleRef.current = title
  }, [title])

  useEffect(() => {
    subtitleRef.current = subtitle
  }, [subtitle])

  useEffect(() => {
    bodyValueRef.current = bodyValue
  }, [bodyValue])

  useEffect(() => {
    loadIdRef.current += 1
    const loadId = loadIdRef.current

    if (!activePage?.docId) {
      setTitle('')
      setSubtitle('')
      setBodyValue(EMPTY_EDITOR_VALUE)
      setSlug('')
      setLoadedDocId(null)
      setLoading(false)
      setError(null)
      savedTitleRef.current = ''
      savedSubtitleRef.current = ''
      savedBodyRef.current = serializeEditorValue(EMPTY_EDITOR_VALUE)
      lastLoadedDocIdRef.current = null
      pendingRevisionCheckpointRef.current = false
      lastAutosavedAtRef.current = Date.now()
      lastCheckpointedSignatureRef.current = revisionSignature(
        serializeEditorValue(EMPTY_EDITOR_VALUE),
        '',
      )
      setDocDraftSession({
        baselineValue: EMPTY_EDITOR_VALUE,
        bodyValue: EMPTY_EDITOR_VALUE,
        docDraftInfo: {
          id: '',
          title: '',
          subtitle: '',
          slug: '',
          insertedAt: null,
          updatedAt: null,
          author: null,
          publishState: null,
          wordCount: 0,
          characterCount: 0,
        },
        saveError: null,
        saveStatus: 'idle',
      })
      return
    }

    if (activePage.docId === lastLoadedDocIdRef.current && !revisionReloadKey) {
      return
    }

    if (
      !initialDraftConsumedRef.current &&
      initialDraft &&
      initialDraft.id === activePage.docId &&
      !revisionReloadKey
    ) {
      const nextSession = resolveDraftSession(initialDraft, activePage)

      initialDraftConsumedRef.current = true
      setTitle(nextSession.title)
      setSubtitle(nextSession.subtitle)
      setBodyValue(nextSession.body)
      setSlug(nextSession.slug)
      setLoadedDocId(activePage.docId)
      savedTitleRef.current = nextSession.title
      savedSubtitleRef.current = nextSession.subtitle
      savedBodyRef.current = nextSession.bodyJson
      lastLoadedDocIdRef.current = activePage.docId
      pendingRevisionCheckpointRef.current = false
      lastAutosavedAtRef.current = Date.now()
      lastCheckpointedSignatureRef.current = revisionSignature(
        nextSession.bodyJson,
        nextSession.subtitle,
      )
      setDocDraftSession({
        baselineValue: nextSession.body,
        bodyValue: nextSession.body,
        docDraftInfo: nextSession.info,
        saveError: null,
        saveStatus: 'saved',
      })
      return
    }

    setLoading(true)
    setError(null)
    setDocDraftSession({ saveError: null, saveStatus: 'idle' })

    query<{ docDraft?: TDocDraftDTO }>(S.docDraft, { community, id: activePage.docId })
      .then((data) => {
        if (loadIdRef.current !== loadId) return

        const draft = data?.docDraft
        const nextSession = resolveDraftSession(draft, activePage)

        setTitle(nextSession.title)
        setSubtitle(nextSession.subtitle)
        setBodyValue(nextSession.body)
        setSlug(nextSession.slug)
        setLoadedDocId(activePage.docId)
        savedTitleRef.current = nextSession.title
        savedSubtitleRef.current = nextSession.subtitle
        savedBodyRef.current = nextSession.bodyJson
        lastLoadedDocIdRef.current = activePage.docId
        pendingRevisionCheckpointRef.current = false
        lastAutosavedAtRef.current = Date.now()
        lastCheckpointedSignatureRef.current = revisionSignature(
          nextSession.bodyJson,
          nextSession.subtitle,
        )
        setDocDraftSession({
          baselineValue: nextSession.body,
          bodyValue: nextSession.body,
          docDraftInfo: nextSession.info,
          saveError: null,
          saveStatus: 'saved',
        })
      })
      .catch((err) => {
        if (loadIdRef.current !== loadId) return
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        setDocDraftSession({ saveError: message, saveStatus: 'error' })
      })
      .finally(() => {
        if (loadIdRef.current === loadId) setLoading(false)
      })
  }, [
    activePage,
    activePage?.docId,
    activePage?.id,
    community,
    initialDraft,
    query,
    revisionReloadKey,
    setDocDraftSession,
  ])

  useEffect(() => {
    const trimmedTitle = title.trim()
    if (!activePage || !trimmedTitle) {
      setSlug('')
      return
    }

    const timer = window.setTimeout(() => {
      slugify(trimmedTitle)
        .then((nextSlug) => {
          slugTitleRef.current = trimmedTitle
          setSlug(nextSlug)
        })
        .catch(() => {
          slugTitleRef.current = ''
          setSlug('')
        })
    }, 260)

    return () => window.clearTimeout(timer)
  }, [activePage, title])

  const dirty =
    title !== savedTitleRef.current ||
    subtitle !== savedSubtitleRef.current ||
    serializeEditorValue(bodyValue) !== savedBodyRef.current
  const editable = !!activePage?.docId
  const invalid = !title.trim()
  const bodyStats = useMemo(() => countEditorText(bodyValue), [bodyValue])

  const save = useCallback(async () => {
    if (!activePage?.docId || invalid || savingRef.current) return

    const nextTitle = title.trim()
    const nextSubtitle = subtitle.trim()
    const body = serializeEditorValue(bodyValue)

    savingRef.current = true
    setSaving(true)
    setError(null)
    setDocDraftSession({ saveError: null, saveStatus: 'saving' })

    try {
      const nextSlug = slugTitleRef.current === nextTitle && slug ? slug : await slugify(nextTitle)

      const data = await mutate<{ updateDocDraft?: TDocDraftDTO }>(S.updateDocDraft, {
        community,
        id: activePage.docId,
        title: nextTitle,
        subtitle: nextSubtitle,
        slug: nextSlug,
        body,
      })

      const savedDraft = data?.updateDocDraft
      const savedSlug = savedDraft?.slug || nextSlug
      const currentTitle = titleRef.current
      const currentSubtitle = subtitleRef.current
      const currentBody = serializeEditorValue(bodyValueRef.current)

      if (currentTitle === title) setTitle(nextTitle)
      if (currentSubtitle === subtitle) setSubtitle(nextSubtitle)
      if (currentTitle.trim() === nextTitle) setSlug(savedSlug)
      savedTitleRef.current = nextTitle
      savedSubtitleRef.current = nextSubtitle
      savedBodyRef.current = body
      lastAutosavedAtRef.current = Date.now()
      pendingRevisionCheckpointRef.current =
        revisionSignature(body, nextSubtitle) !== lastCheckpointedSignatureRef.current
      setDocDraftSession({
        bodyValue: bodyValueRef.current,
        docDraftInfo: {
          id: savedDraft?.id || activePage.docId,
          title: currentTitle === title ? nextTitle : currentTitle,
          subtitle: currentSubtitle === subtitle ? nextSubtitle : currentSubtitle,
          slug: currentTitle.trim() === nextTitle ? savedSlug : slug,
          insertedAt: savedDraft?.insertedAt || null,
          updatedAt: savedDraft?.updatedAt || new Date().toISOString(),
          author: savedDraft?.author || null,
          publishState: activePage.publishState || null,
          ...countEditorText(bodyValueRef.current),
        },
        saveError: null,
        saveStatus:
          currentTitle !== title || currentSubtitle !== subtitle || currentBody !== body
            ? 'dirty'
            : 'saved',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setDocDraftSession({ saveError: message, saveStatus: 'error' })
      toast(message, 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [activePage, bodyValue, community, invalid, mutate, setDocDraftSession, slug, subtitle, title])

  const checkpointRevision = useCallback(async () => {
    if (!activePage?.docId || checkpointingRef.current || !pendingRevisionCheckpointRef.current) {
      return
    }

    const checkpointSignature = revisionSignature(savedBodyRef.current, savedSubtitleRef.current)
    checkpointingRef.current = true

    try {
      await mutate(S.checkpointDocDraftRevision, {
        community,
        id: activePage.docId,
      })
      lastCheckpointedSignatureRef.current = checkpointSignature
      pendingRevisionCheckpointRef.current =
        revisionSignature(savedBodyRef.current, savedSubtitleRef.current) !== checkpointSignature
    } catch (err) {
      const message = err instanceof Error ? err.message : t(REVISION_LABEL_KEY.CHECKPOINT_FAILED)
      lastAutosavedAtRef.current = Date.now()
      toast(message, 'error')
    } finally {
      checkpointingRef.current = false
    }
  }, [activePage?.docId, community, mutate, t])

  const markRevisionCheckpointPending = useCallback(() => {
    pendingRevisionCheckpointRef.current = true
  }, [])

  const editTitle = useCallback(
    (value: string): void => {
      markRevisionCheckpointPending()
      setTitle(value)
    },
    [markRevisionCheckpointPending],
  )

  const editSubtitle = useCallback(
    (value: string): void => {
      markRevisionCheckpointPending()
      setSubtitle(value)
    },
    [markRevisionCheckpointPending],
  )

  const editBodyValue = useCallback(
    (value: TRichEditorValue): void => {
      markRevisionCheckpointPending()
      setBodyValue(value)
      setDocDraftSession({ bodyValue: value })
    },
    [markRevisionCheckpointPending, setDocDraftSession],
  )

  useEffect(() => {
    attachSaveDocDraft(save)

    return () => attachSaveDocDraft(null)
  }, [attachSaveDocDraft, save])

  useEffect(() => {
    if (!activePage?.docId) return
    if (activePage.docId !== loadedDocId) return

    setDocDraftSession({
      bodyValue,
      docDraftInfo: {
        ...docsEditor$.docDraftInfo,
        id: activePage.docId,
        title,
        subtitle,
        slug,
        publishState: activePage.publishState || null,
        ...bodyStats,
      },
      saveError: dirty ? null : docsEditor$.saveError,
      saveStatus: dirty ? 'dirty' : docsEditor$.saveStatus === 'saving' ? 'saving' : 'saved',
    })
  }, [
    activePage?.docId,
    activePage?.publishState,
    bodyStats,
    community,
    dirty,
    docsEditor$,
    loadedDocId,
    setDocDraftSession,
    slug,
    subtitle,
    title,
  ])

  useEffect(() => {
    if (!dirty || !editable || invalid || loading || saving) return

    const timer = window.setTimeout(() => {
      save()
    }, DOC_AUTO_SAVE_DELAY)

    return () => window.clearTimeout(timer)
  }, [dirty, editable, invalid, loading, save, saving])

  useEffect(() => {
    if (
      !activePage?.docId ||
      !editable ||
      invalid ||
      loading ||
      saving ||
      revisionSignature(savedBodyRef.current, savedSubtitleRef.current) ===
        lastCheckpointedSignatureRef.current
    ) {
      return
    }

    const elapsed = Date.now() - lastAutosavedAtRef.current
    const delay = Math.max(DOC_DRAFT_REVISION_CHECKPOINT_DELAY - elapsed, 0)
    const timer = window.setTimeout(() => {
      void checkpointRevision()
    }, delay)

    return () => window.clearTimeout(timer)
  }, [activePage?.docId, checkpointRevision, editable, invalid, loading, saving])

  return {
    activePage,
    bodyValue,
    dirty,
    editable,
    editorDocId: loadedDocId ?? '',
    error,
    invalid,
    loading,
    saving,
    save,
    setBodyValue: editBodyValue,
    setSubtitle: editSubtitle,
    setTitle: editTitle,
    slug,
    subtitle,
    title,
  }
}
