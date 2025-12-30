import { findIndex } from 'ramda'
import { useMemo } from 'react'
import { groupByKey } from '~/helper'
import useArticles from '~/hooks/useArticles'
import type { TGroupedTags, TTag } from '~/spec'
import { getParameterByName } from '~/utils/route'

type TRet = {
  tags: readonly TTag[]
  activeTag: TTag | null

  groupedTags: TGroupedTags
  onTagSelect: (tag: TTag) => void
  syncActiveTagFromURL: () => void

  maxDisplayCount: number
  totalCountThreshold: number
}

export default (): TRet => {
  const store = useArticles()
  const { tags, activeTag } = store

  // derived data
  const groupedTags = useMemo<TGroupedTags>(() => {
    return groupByKey(tags, 'group')
  }, [tags])

  const onTagSelect = (tag: TTag): void => store.commit({ activeTag: tag })

  const syncActiveTagFromURL = (): void => {
    const tagOnURL = getParameterByName('tag')
    if (!tagOnURL) return

    const idx = findIndex((t) => t.slug === tagOnURL, tags)
    if (idx < 0) return

    onTagSelect(tags[idx])
  }

  return {
    tags,
    activeTag,

    groupedTags,
    onTagSelect,
    syncActiveTagFromURL,

    maxDisplayCount: 3,
    totalCountThreshold: 10,
  }
}
