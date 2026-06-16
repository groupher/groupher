import type { TRichEditorValue } from '@groupher/rich-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import { slugify } from '~/lib/slug'
import { toast } from '~/signal'
import useCommunity from '~/stores/community/hooks'

import S from '../../../../schema'
import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import type { TSideTreePage } from '../SideTree/spec'
import type { TSideTreeController } from '../SideTree/useSideTree'

type TDocDraftDTO = {
  id: string
  title?: string | null
  slug?: string | null
  digest?: string | null
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
  const savedTitleRef = useRef('')
  const savedBodyRef = useRef(serializeEditorValue(EMPTY_EDITOR_VALUE))
  const slugTitleRef = useRef('')

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
      return
    }

    setLoading(true)
    setError(null)

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
      })
      .catch((err) => {
        if (loadIdRef.current !== loadId) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (loadIdRef.current === loadId) setLoading(false)
      })
  }, [activePage?.docId, activePage?.id, community, query])

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

  const save = useCallback(async () => {
    if (!activePage?.docId || invalid) return

    const nextTitle = title.trim()
    const body = serializeEditorValue(bodyValue)

    setSaving(true)
    setError(null)

    try {
      const nextSlug = slugTitleRef.current === nextTitle && slug ? slug : await slugify(nextTitle)

      await mutate(S.updateDocDraft, {
        community,
        id: activePage.docId,
        title: nextTitle,
        slug: nextSlug,
        body,
      })

      setTitle(nextTitle)
      setSlug(nextSlug)
      savedTitleRef.current = nextTitle
      savedBodyRef.current = body
      toast('设置已保存')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }, [activePage, bodyValue, community, invalid, mutate, slug, title])

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
