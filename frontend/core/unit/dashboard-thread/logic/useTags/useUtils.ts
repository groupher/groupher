import { filter, findIndex, reject, remove } from 'ramda'
import { THREAD } from '~/const/thread'
import { sortByIndex } from '~/helper'
import useCommunity from '~/stores/community/hooks'

import useDashboard from '~/stores/dashboard/hooks'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import type { TTag, TThread } from '~/spec'

import S from '../../schema'

type TRet = {
  loadTags: (thread?: TThread) => void
  moveTag: (tag: TTag, opt: 'up' | 'down') => void
  moveTag2Edge: (tag: TTag, opt: 'top' | 'bottom') => void
}

export default function useUtils(): TRet {
  const dsb$ = useDashboard()
  const community$ = useCommunity()
  const { query } = useGraphQLClient()

  const { original } = dsb$

  const loadTags = (activeThread = THREAD.POST): void => {
    const community = community$.slug
    const thread = activeThread.toUpperCase()

    const params = {
      filter: { community, thread },
    }

    dsb$.commit({ loading: true })
    query(S.pagedCommunityTags, params).then((data) => {
      // @ts-expect-error
      const tags = data.pagedCommunityTags.entries
      dsb$.commit({ tags, original: { ...original, tags }, loading: false })
    })
  }

  const _reindex = (tags: TTag[]): TTag[] => tags.map((item, index) => ({ ...item, index }))

  const moveTag = (tag: TTag, opt: 'up' | 'down'): void => {
    const { tags } = dsb$
    const { group } = tag

    const tagsWithIndex = tags
      .filter((tag) => tag.index !== undefined)
      .map((tag) => ({ ...tag, index: tag.index! }))

    const groupTags = sortByIndex(tagsWithIndex.filter((item) => item.group === group)) as TTag[]

    const restTags = reject((item: TTag) => item.group === group, tags)
    const tagIndex = findIndex((item: TTag) => item.id === tag.id, groupTags)

    const targetIndex = opt === 'up' ? tagIndex - 1 : tagIndex + 1

    const tmp = groupTags[targetIndex]
    groupTags[targetIndex] = groupTags[tagIndex]
    groupTags[tagIndex] = tmp

    const tmpIndex = groupTags[targetIndex].index
    groupTags[targetIndex].index = groupTags[tagIndex].index
    groupTags[tagIndex].index = tmpIndex

    dsb$.commit({ tags: [...restTags, ..._reindex(groupTags)] })
  }

  const moveTag2Edge = (tag: TTag, opt: 'top' | 'bottom'): void => {
    const { tags } = dsb$
    const { group } = tag

    const groupTags = filter((item: TTag) => item.group === group, tags)
    const restTags = reject((item: TTag) => item.group === group, tags)

    const curTagItemIndex = findIndex((item: TTag) => item.id === tag.id, groupTags)
    const curTagItem = groupTags[curTagItemIndex]

    const newTags =
      opt === 'top'
        ? [curTagItem, ...remove(curTagItemIndex, 1, groupTags)]
        : [...remove(curTagItemIndex, 1, groupTags), curTagItem]

    dsb$.commit({ tags: [...restTags, ..._reindex(newTags)] })
  }

  return {
    loadTags,
    moveTag,
    moveTag2Edge,
  }
}
