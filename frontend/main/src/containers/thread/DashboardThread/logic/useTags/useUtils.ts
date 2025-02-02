import { reject, filter, findIndex, remove, clone } from 'ramda'

import type { TTag, TThread } from '~/spec'
import { THREAD } from '~/const/thread'
import { sortByIndex } from '~/helper'

import useSubState from '~/hooks/useSubStore'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import { query } from '~/server'

import S from '../../schema'

type TRet = {
  loadTags: (thread?: TThread) => void
  moveTag: (tag: TTag, opt: 'up' | 'down') => void
  moveTag2Edge: (tag: TTag, opt: 'top' | 'bottom') => void
}

export default (): TRet => {
  const store = useSubState('dashboard')
  const curCommunity = useViewingCommunity()

  const { original } = store

  const loadTags = (activeThread = THREAD.POST): void => {
    const community = curCommunity.slug
    const thread = activeThread.toUpperCase()

    const params = {
      filter: { community, thread },
    }

    store.commit({ loading: true })
    query(S.pagedArticleTags, params).then((data) => {
      const tags = data.pagedArticleTags.entries
      store.commit({ tags, original: { ...original, tags }, loading: false })
    })
  }

  const _reindex = (tags: TTag[]): TTag[] => tags.map((item, index) => ({ ...item, index }))

  const moveTag = (tag: TTag, opt: 'up' | 'down'): void => {
    const { tags } = store
    const { group } = tag

    const groupTags = clone(sortByIndex(filter((item: TTag) => item.group === group, tags)))
    const restTags = reject((item: TTag) => item.group === group, tags)
    const tagIndex = findIndex((item: TTag) => item.id === tag.id, groupTags)

    const targetIndex = opt === 'up' ? tagIndex - 1 : tagIndex + 1

    const tmp = groupTags[targetIndex]
    groupTags[targetIndex] = groupTags[tagIndex]
    groupTags[tagIndex] = tmp

    const tmpIndex = groupTags[targetIndex].index
    groupTags[targetIndex].index = groupTags[tagIndex].index
    groupTags[tagIndex].index = tmpIndex

    store.commit({ tags: [...restTags, ..._reindex(groupTags)] })
  }

  const moveTag2Edge = (tag: TTag, opt: 'top' | 'bottom'): void => {
    const { tags } = store
    const { group } = tag

    const groupTags = filter((item: TTag) => item.group === group, tags)
    const restTags = reject((item: TTag) => item.group === group, tags)

    const curTagItemIndex = findIndex((item: TTag) => item.id === tag.id, groupTags)
    const curTagItem = groupTags[curTagItemIndex]

    const newTags =
      opt === 'top'
        ? [curTagItem, ...remove(curTagItemIndex, 1, groupTags)]
        : [...remove(curTagItemIndex, 1, groupTags), curTagItem]

    store.commit({ tags: [...restTags, ..._reindex(newTags)] })
  }

  return {
    loadTags,
    moveTag,
    moveTag2Edge,
  }
}
