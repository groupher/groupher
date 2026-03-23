import { pluck, reject, uniq } from 'ramda'
import { useMemo, useState } from 'react'
import EVENT from '~/const/event'
import { CHANGE_MODE } from '~/const/mode'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import useGraphQLClient from '~/hooks/useGraphQLClient'

import { closeDrawer, send } from '~/signal'
import type { TChangeMode, TEditValue, TSelectOption, TTag } from '~/spec'
import { nilOrEmpty } from '~/validator'

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
  curCategory: TSelectOption
  categoryOptions: TSelectOption[]
}

export default function useLogic(): TRet {
  const dsb$ = useDashboard()
  const { tags, settingTag, activeTagThread } = dsb$

  const community$ = useCommunity()

  const { mutate } = useGraphQLClient()

  const [editingTag, setEditingTag] = useState<TTag | null>(null)
  const [mode, setMode] = useState<TChangeMode>(CHANGE_MODE.UPDATE)
  const [processing, setProcessing] = useState(false)

  const initEditingTag = (mode: TChangeMode): void => {
    setMode(mode)
    if (mode === CHANGE_MODE.CREATE) {
      setEditingTag(DEFAULT_CREATE_TAG)
    } else {
      setEditingTag(settingTag)
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

    mutate(S.deleteCommunityTag, { id, community: community.slug, thread }).then((res) => {
      console.log('## deleteCommunityTag: ', res)
      _handleDone()
    })
  }

  const onUpdate = (): void => {
    setProcessing(true)

    const params = {
      ...editingTag,
      slug: editingTag.title,
      community: community$.slug,
      thread: activeTagThread,
    }

    mutate(S.updateCommunityTag, params).then((res) => {
      console.log('## updateCommunityTag: ', res)
      _handleDone()
    })
  }

  const onCreate = (): void => {
    setProcessing(true)

    const params = {
      ...editingTag,
      slug: editingTag.title,
      community: community$.slug,
      thread: activeTagThread,
    }

    mutate(S.createCommunityTag, params).then((res) => {
      console.log('## createCommunityTag: ', res)
      _handleDone()
    })
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

  return {
    mode,
    initEditingTag,
    editingTag,
    processing,
    edit,
    onDelete,
    onUpdate,
    onCreate,

    curCategory,
    categoryOptions,
  }
}
