import { useState, useCallback } from 'react'
import { uniq, reject, pluck } from 'ramda'

import type { TTag, TEditValue, TChangeMode, TSelectOption } from '~/spec'
import EVENT from '~/const/event'
import { CHANGE_MODE } from '~/const/mode'

import { mutate } from '~/server'
import { nilOrEmpty } from '~/validator'

import { send, closeDrawer } from '~/signal'

import useSubStore from '~/hooks/useSubStore'
import useViewingCommunity from '~/hooks/useViewingCommunity'

import { DEFAULT_CREATE_TAG } from './constant'
import S from './schema'

type TRet = {
  mode: TChangeMode
  processing: boolean
  editingTag: TTag | null
  initEditingTag: (mode: TChangeMode) => void

  edit: (e: TEditValue, key) => void
  onDelete: (tag: TTag) => void
  onUpdate: () => void
  onCreate: () => void
  getCategory: () => TSelectOption
  getCategoryOptions: () => TSelectOption[]
}

export default (): TRet => {
  const dashboard = useSubStore('dashboard')

  const curCommunity = useViewingCommunity()

  const [editingTag, setEditingTag] = useState<TTag | null>(null)
  const [mode, setMode] = useState(CHANGE_MODE.UPDATE)
  const [processing, setProcessing] = useState(false)

  const initEditingTag = (mode: TChangeMode): void => {
    setMode(mode)
    if (mode === CHANGE_MODE.CREATE) {
      setEditingTag(DEFAULT_CREATE_TAG)
    } else {
      setEditingTag(dashboard.settingTag)
    }
  }

  const edit = (e: TEditValue, key): void => {
    setEditingTag({ ...editingTag, [key]: e })
  }

  const _handleDone = (): void => {
    closeDrawer()
    send(EVENT.REFRESH_TAGS)
    setProcessing(false)
  }

  const onDelete = (tag: TTag): void => {
    setProcessing(true)
    const { id, thread, community } = tag

    mutate(S.deleteArticleTag, { id, community: community.slug, thread }).then((res) => {
      console.log('## deleteArticleTag: ', res)
      _handleDone()
    })
  }

  const onUpdate = (): void => {
    setProcessing(true)

    const params = {
      ...editingTag,
      slug: editingTag.title,
      community: curCommunity.slug,
      thread: dashboard.activeTagThread,
    }

    mutate(S.updateArticleTag, params).then((res) => {
      console.log('## updateArticleTag: ', res)
      _handleDone()
    })
  }

  const onCreate = (): void => {
    setProcessing(true)

    const params = {
      ...editingTag,
      slug: editingTag.title,
      community: curCommunity.slug,
      thread: dashboard.activeTagThread,
    }

    mutate(S.createArticleTag, params).then((res) => {
      console.log('## createArticleTag: ', res)
      _handleDone()
    })
  }

  // drived
  const getCategory = useCallback((): TSelectOption => {
    if (!editingTag) return { label: '', value: '' }

    const { group } = editingTag

    return {
      label: group,
      value: group,
    }
  }, [editingTag])

  const getCategoryOptions = useCallback((): TSelectOption[] => {
    if (!editingTag) return []

    const tagGroups = uniq(pluck('group', dashboard.tags))

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
  }, [dashboard, editingTag])

  return {
    mode,
    initEditingTag,
    editingTag,
    processing,
    edit,
    onDelete,
    onUpdate,
    onCreate,

    // drived
    getCategory,
    getCategoryOptions,
  }
}
