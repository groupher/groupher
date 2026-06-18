import type { TRichEditorValue } from '@groupher/rich-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import { slugify } from '~/lib/slug'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/widgets/Toaster'

import S from '../../../../schema'
import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import type { TSideTreePage } from '../SideTree/spec'
import type { TSideTreeController } from '../SideTree/useSideTree'
import useDocsEditor from '../store/hooks'
import { countEditorText, DOC_AUTO_SAVE_DELAY } from './helper'

type TDocDraftDTO = {
  id: string
  title?: string | null
  slug?: string | null
  digest?: string | null
  insertedAt?: string | null
  updatedAt?: string | null
  author?: {
    login?: string | null
    nickname?: string | null
    avatar?: string | null
  } | null
  document?: {
    json?: string | null
  } | null
}

export const EMPTY_EDITOR_VALUE: TRichEditorValue = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
]

const parseEditorValue = (json?: string | null): TRichEditorValue => {
  if (!json) return EMPTY_EDITOR_VALUE

  try {
    const value = JSON.parse(json)
    return Array.isArray(value) ? (value as TRichEditorValue) : EMPTY_EDITOR_VALUE
  } catch {
    return EMPTY_EDITOR_VALUE
  }
}

const serializeEditorValue = (value: TRichEditorValue): string => JSON.stringify(value)

const findActivePage = (groups: TSideTreeController['groups'], activeId: string | null) => {
  if (!activeId) return null

  for (const group of groups) {
    const child = group.children.find((item) => item.id === activeId)
    if (child?.type === SIDE_TREE_NODE_TYPE.PAGE) {
      return child as TSideTreePage
    }
  }

  return null
}

export default function useDocDraftEditor(sideTree: TSideTreeController) {
  const { slug: community } = useCommunity()
  const { attachSaveDocDraft, live$: docsEditor$, setDocDraftSession } = useDocsEditor()
  const { query, mutate } = useGraphQLClient()
  const activePage = useMemo(
    () => findActivePage(sideTree.groups, sideTree.activeId),
    [sideTree.activeId, sideTree.groups],
  )
  const [title, setTitle] = useState('')
  const [bodyValue, setBodyValue] = useState<TRichEditorValue>(EMPTY_EDITOR_VALUE)
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadIdRef = useRef(0)
  const bodyValueRef = useRef<TRichEditorValue>(EMPTY_EDITOR_VALUE)
  const savedTitleRef = useRef('')
  const savedBodyRef = useRef(serializeEditorValue(EMPTY_EDITOR_VALUE))
  const savingRef = useRef(false)
  const slugTitleRef = useRef('')
  const titleRef = useRef('')

  useEffect(() => {
    titleRef.current = title
  }, [title])

  useEffect(() => {
    bodyValueRef.current = bodyValue
  }, [bodyValue])

  useEffect(() => {
    loadIdRef.current += 1
    const loadId = loadIdRef.current

    if (!activePage?.docId) {
      setTitle('')
      setBodyValue(EMPTY_EDITOR_VALUE)
      setSlug('')
      setLoading(false)
      setError(null)
      savedTitleRef.current = ''
      savedBodyRef.current = serializeEditorValue(EMPTY_EDITOR_VALUE)
      setDocDraftSession({
        docDraftInfo: {
          id: '',
          title: '',
          slug: '',
          insertedAt: null,
          updatedAt: null,
          author: null,
          wordCount: 0,
          characterCount: 0,
        },
        saveError: null,
        saveStatus: 'idle',
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
        const nextTitle = draft?.title || activePage.title || ''
        const nextBody = parseEditorValue(draft?.document?.json)
        const nextBodyJson = serializeEditorValue(nextBody)

        setTitle(nextTitle)
        setBodyValue(nextBody)
        setSlug(draft?.slug || '')
        savedTitleRef.current = nextTitle
        savedBodyRef.current = nextBodyJson
        setDocDraftSession({
          docDraftInfo: {
            id: draft?.id || activePage.docId,
            title: nextTitle,
            slug: draft?.slug || '',
            insertedAt: draft?.insertedAt || null,
            updatedAt: draft?.updatedAt || null,
            author: draft?.author || null,
            ...countEditorText(nextBody),
          },
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
  }, [activePage?.docId, activePage?.id, community, query, setDocDraftSession])

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
    title !== savedTitleRef.current || serializeEditorValue(bodyValue) !== savedBodyRef.current
  const editable = !!activePage?.docId
  const invalid = !title.trim()
  const bodyStats = useMemo(() => countEditorText(bodyValue), [bodyValue])

  const save = useCallback(async () => {
    if (!activePage?.docId || invalid || savingRef.current) return

    const nextTitle = title.trim()
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
        slug: nextSlug,
        body,
      })

      const savedDraft = data?.updateDocDraft
      const savedSlug = savedDraft?.slug || nextSlug
      const currentTitle = titleRef.current
      const currentBody = serializeEditorValue(bodyValueRef.current)

      if (currentTitle === title) setTitle(nextTitle)
      if (currentTitle.trim() === nextTitle) setSlug(savedSlug)
      savedTitleRef.current = nextTitle
      savedBodyRef.current = body
      setDocDraftSession({
        docDraftInfo: {
          id: savedDraft?.id || activePage.docId,
          title: currentTitle === title ? nextTitle : currentTitle,
          slug: currentTitle.trim() === nextTitle ? savedSlug : slug,
          insertedAt: savedDraft?.insertedAt || null,
          updatedAt: savedDraft?.updatedAt || new Date().toISOString(),
          author: savedDraft?.author || null,
          ...countEditorText(bodyValueRef.current),
        },
        saveError: null,
        saveStatus: currentTitle !== title || currentBody !== body ? 'dirty' : 'saved',
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
  }, [activePage, bodyValue, community, invalid, mutate, setDocDraftSession, slug, title])

  useEffect(() => {
    attachSaveDocDraft(save)

    return () => attachSaveDocDraft(null)
  }, [attachSaveDocDraft, save])

  useEffect(() => {
    if (!activePage?.docId) return

    setDocDraftSession({
      docDraftInfo: {
        ...docsEditor$.docDraftInfo,
        id: activePage.docId,
        title,
        slug,
        ...bodyStats,
      },
      saveError: dirty ? null : docsEditor$.saveError,
      saveStatus: dirty ? 'dirty' : docsEditor$.saveStatus === 'saving' ? 'saving' : 'saved',
    })
  }, [activePage?.docId, bodyStats, community, dirty, docsEditor$, setDocDraftSession, slug, title])

  useEffect(() => {
    if (!dirty || !editable || invalid || loading || saving) return

    const timer = window.setTimeout(() => {
      save()
    }, DOC_AUTO_SAVE_DELAY)

    return () => window.clearTimeout(timer)
  }, [dirty, editable, invalid, loading, save, saving])

  return {
    activePage,
    bodyValue,
    dirty,
    editable,
    error,
    invalid,
    loading,
    saving,
    save,
    setBodyValue,
    setTitle,
    slug,
    title,
  }
}
