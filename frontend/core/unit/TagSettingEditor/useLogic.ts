import { pluck, reject, uniq } from 'ramda'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import EVENT from '~/const/event'
import { CHANGE_MODE } from '~/const/mode'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import { closeDrawer, send } from '~/signal'
import type { TChangeMode, TEditValue, TSelectOption, TTag } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import { slugify } from '~/utils/slug'
import { nilOrEmpty, validateSlug } from '~/validator'

import { DEFAULT_CREATE_TAG } from './constant'
import S from './schema'

type TArgs = {
  initialGroup?: string
  onDone?: () => void
}

type TRet = {
  mode: TChangeMode
  processing: boolean
  editingTag: TTag | null
  slugError: string
  canSubmit: boolean
  initEditingTag: (mode: TChangeMode) => void

  edit: (e: TEditValue, key) => void
  onDelete: (tag: TTag) => void
  onUpdate: () => void
  onCreate: () => void
  curCategory: TSelectOption
  categoryOptions: TSelectOption[]
}

export default function useLogic({ initialGroup = '', onDone }: TArgs = {}): TRet {
  const dsb$ = useDashboard()
  const { tags, settingTag, activeTagThread } = dsb$

  const community$ = useCommunity()

  const { mutate } = useGraphQLClient()

  const [editingTag, setEditingTag] = useState<TTag | null>(null)
  const [mode, setMode] = useState<TChangeMode>(CHANGE_MODE.UPDATE)
  const [processing, setProcessing] = useState(false)
  const [slugEdited, setSlugEdited] = useState(false)
  const slugRequestId = useRef(0)

  const initEditingTag = useCallback(
    (mode: TChangeMode): void => {
      setMode(mode)
      if (mode === CHANGE_MODE.CREATE) {
        const defaultGroup = initialGroup || tags.find((tag) => !nilOrEmpty(tag.group))?.group || ''
        setEditingTag({ ...DEFAULT_CREATE_TAG, group: defaultGroup, thread: activeTagThread })
      } else {
        setEditingTag(settingTag)
      }
      setSlugEdited(false)
    },
    [activeTagThread, initialGroup, settingTag, tags],
  )

  const edit = (e: TEditValue, key): void => {
    if (!editingTag) return
    if (key === 'slug') setSlugEdited(true)
    if (key === 'title' && !slugEdited) {
      setEditingTag({ ...editingTag, title: e as string, slug: '' })
      return
    }

    setEditingTag({ ...editingTag, [key]: e })
  }

  useEffect(() => {
    if (!editingTag || slugEdited) return

    const title = editingTag.title?.trim()
    if (!title) {
      setEditingTag((tag) => (tag ? { ...tag, slug: '' } : tag))
      return
    }

    const requestId = ++slugRequestId.current
    const timer = window.setTimeout(() => {
      slugify(title)
        .then((slug) => {
          if (slugRequestId.current !== requestId) return
          setEditingTag((tag) => {
            if (!tag) return tag
            if (tag.title?.trim() !== title) return tag
            if (tag.slug === slug) return tag

            return { ...tag, slug }
          })
        })
        .catch(() => undefined)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [editingTag?.title, slugEdited])

  const _handleDone = (): void => {
    setProcessing(false)
    closeDrawer()
    send(EVENT.REFRESH_TAGS)
    onDone?.()
  }

  const onDelete = (tag: TTag): void => {
    if (!tag) return
    setProcessing(true)
    const { id, thread, community } = tag

    mutate(S.deleteCommunityTag, { id, community: community.slug, thread })
      .then((res) => {
        console.log('## deleteCommunityTag: ', res)
        _handleDone()
      })
      .catch(() => undefined)
      .finally(() => setProcessing(false))
  }

  const onUpdate = (): void => {
    setProcessing(true)
    if (!activeTagThread || !editingTag) {
      setProcessing(false)
      return
    }

    if (!validateSlug(editingTag.slug).valid) {
      setProcessing(false)
      return
    }

    mutate(S.updateCommunityTag, {
      ...editingTag,
      slug: validateSlug(editingTag.slug).value,
      community: community$.slug,
      thread: activeTagThread,
    })
      .then((res) => {
        console.log('## updateCommunityTag: ', res)
        _handleDone()
      })
      .catch(() => undefined)
      .finally(() => setProcessing(false))
  }

  const onCreate = (): void => {
    setProcessing(true)
    if (!activeTagThread || !editingTag) {
      setProcessing(false)
      return
    }

    if (!validateSlug(editingTag.slug).valid) {
      setProcessing(false)
      return
    }

    const params = {
      ...editingTag,
      slug: validateSlug(editingTag.slug).value,
      community: community$.slug,
      thread: activeTagThread,
    }
    delete params.desc

    mutate(S.createCommunityTag, params)
      .then((res) => {
        console.log('## createCommunityTag: ', res)
        _handleDone()
      })
      .catch(() => undefined)
      .finally(() => setProcessing(false))
  }

  const curCategory = useMemo((): TSelectOption => {
    if (!editingTag) return { label: '', value: '' }

    const { group } = editingTag

    return {
      label: group,
      value: group,
    }
  }, [editingTag])

  const categoryOptions = useMemo((): TSelectOption[] => {
    if (!editingTag) return []

    const tagGroups = uniq(pluck('group', tags))

    const existOptions = tagGroups.map((cat) => ({
      label: cat,
      value: cat,
    }))

    let retOptions = existOptions

    const { group } = editingTag
    if (group) {
      retOptions = uniq([
        {
          label: group,
          value: group,
        },
        ...existOptions,
      ])
    }

    return reject((opt: TSelectOption) => nilOrEmpty(opt.value), uniq(retOptions))
  }, [editingTag, tags])

  const slugValidation = validateSlug(editingTag?.slug)
  const slugError =
    editingTag?.slug && !slugValidation.valid
      ? `dsb.tags.editor.slug.error.${slugValidation.reason}`
      : ''
  const canSubmit =
    !!activeTagThread &&
    !!editingTag?.title?.trim() &&
    (mode !== CHANGE_MODE.CREATE || !!editingTag?.group?.trim()) &&
    slugValidation.valid

  return {
    mode,
    initEditingTag,
    editingTag,
    processing,
    slugError,
    canSubmit,
    edit,
    onDelete,
    onUpdate,
    onCreate,

    curCategory,
    categoryOptions,
  }
}
