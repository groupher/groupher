import { useCallback } from 'react'
import type { TTag, TGroupedTags } from '~/spec'

import { findIndex } from 'ramda'
import { getParameterByName } from '~/utils/route'
import { groupByKey } from '~/helper'

import useSubStore from '~/hooks/useSubStore'

type TRet = {
  tags: TTag[]
  onTagSelect: (tag: TTag) => void
  syncActiveTagFromURL: () => void
  activeTag: TTag | null
  getGroupedTags: () => TGroupedTags
  maxDisplayCount: number
  totalCountThrold: number
}

export default (): TRet => {
  const store = useSubStore('viewing')
  const { tags, activeTag } = store

  const getGroupedTags = useCallback((): TGroupedTags => groupByKey(tags, 'group'), [tags])

  const syncActiveTagFromURL = (): void => {
    const tagOnURL = getParameterByName('tag')
    if (!tagOnURL) return

    const idx = findIndex((t) => t.slug === tagOnURL, tags)
    if (idx < 0) return

    onTagSelect(tags[idx])
  }

  const onTagSelect = (tag: TTag): void => {
    store.commit({ activeTag: tag })
  }

  return {
    tags,
    activeTag,
    onTagSelect,
    getGroupedTags,
    syncActiveTagFromURL,
    maxDisplayCount: 3,
    totalCountThrold: 10,
  }
}
