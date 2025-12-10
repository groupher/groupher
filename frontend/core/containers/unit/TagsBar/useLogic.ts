import { findIndex } from 'ramda'
import { useCallback } from 'react'
import { groupByKey } from '~/helper'
import useArticles from '~/hooks/useArticles'
import type { TGroupedTags, TTag } from '~/spec'
import { getParameterByName } from '~/utils/route'

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
  const store = useArticles()
  const { tags, activeTag } = store

  const getGroupedTags = useCallback((): TGroupedTags => groupByKey(tags, 'group'), [tags])

  const syncActiveTagFromURL = (): void => {
    const tagOnURL = getParameterByName('tag')
    if (!tagOnURL) return

    const idx = findIndex((t) => t.slug === tagOnURL, tags)
    if (idx < 0) return

    // @ts-expect-error
    onTagSelect(tags[idx])
  }

  const onTagSelect = (tag: TTag): void => {
    store.commit({ activeTag: tag })
  }

  return {
    // @ts-expect-error
    tags,
    // @ts-expect-error
    activeTag,
    onTagSelect,
    getGroupedTags,
    syncActiveTagFromURL,
    maxDisplayCount: 3,
    totalCountThrold: 10,
  }
}
