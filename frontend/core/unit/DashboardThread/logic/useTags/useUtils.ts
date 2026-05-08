import { filter, findIndex, reject, remove } from 'ramda'

import { COLOR } from '~/const/colors'
import { THREAD } from '~/const/thread'
import { sortByIndex } from '~/helper'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import type { TColorName, TTag, TThread } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import { slugify } from '~/utils/slug'

import S from '../../schema'

type TRet = {
  loadTags: (thread?: TThread) => void
  createTag: (title: string, group: string, color?: TColorName) => Promise<void>
  updateTag: (tag: TTag) => Promise<void>
  renameGroup: (fromGroup: string, toGroup: string) => Promise<void>
  moveTag: (tag: TTag, opt: 'up' | 'down') => void
  moveTag2Edge: (tag: TTag, opt: 'top' | 'bottom') => void
}

export default function useUtils(): TRet {
  const dsb$ = useDashboard()
  const community$ = useCommunity()
  const { query, mutate } = useGraphQLClient()

  const { original } = dsb$

  const loadTags = (activeThread: TThread = THREAD.POST): void => {
    const community = community$.slug
    const thread = activeThread

    const params = {
      filter: { community, thread },
    }

    dsb$.commit({ loading: true })
    query(S.pagedCommunityTags, params).then((data) => {
      const tags = data.pagedCommunityTags.entries
      dsb$.commit({ tags, original: { ...original, tags }, loading: false })
    })
  }

  const _reindex = (tags: TTag[]): TTag[] => tags.map((item, index) => ({ ...item, index }))

  const createTag = async (
    title: string,
    group: string,
    color: TColorName = COLOR.BLACK,
  ): Promise<void> => {
    const { activeTagThread } = dsb$
    const thread = activeTagThread || THREAD.POST
    const trimmedTitle = title.trim()
    const trimmedGroup = group.trim()

    if (!trimmedTitle || !trimmedGroup) return

    dsb$.commit({ saving: true })

    try {
      const slug = await slugify(trimmedTitle)

      await mutate(S.createCommunityTag, {
        thread,
        title: trimmedTitle,
        slug,
        layout: null,
        color,
        group: trimmedGroup,
        community: community$.slug,
      })

      loadTags(thread)
    } finally {
      dsb$.commit({ saving: false })
    }
  }

  const updateTag = async (tag: TTag): Promise<void> => {
    const title = tag.title?.trim()

    if (!tag.id || !title) return

    dsb$.commit({ saving: true })

    try {
      const slug = await slugify(title)
      const nextTag = { ...tag, title, slug }

      await mutate(S.updateCommunityTag, {
        ...nextTag,
        community: community$.slug,
      })

      const updatedTags = dsb$.tags.map((item) => (item.id === tag.id ? nextTag : item))

      dsb$.commit({
        tags: updatedTags,
        editingTag: null,
        original: { ...dsb$.original, tags: updatedTags },
      })
    } finally {
      dsb$.commit({ saving: false })
    }
  }

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

  const renameGroup = async (fromGroup: string, toGroup: string): Promise<void> => {
    const { activeTagThread, tags } = dsb$
    const community = community$.slug
    const trimmedGroup = toGroup.trim()

    if (!activeTagThread || !trimmedGroup || trimmedGroup === fromGroup) return

    const targetTags = tags.filter(
      (tag) => tag.thread === activeTagThread && tag.group === fromGroup,
    )

    dsb$.commit({ saving: true })

    try {
      const results = await Promise.allSettled(
        targetTags.map((tag) =>
          mutate(S.updateCommunityTag, {
            id: tag.id,
            community,
            thread: activeTagThread,
            group: trimmedGroup,
          }),
        ),
      )

      const failed = results.some((result) => result.status === 'rejected')

      if (failed) {
        loadTags(activeTagThread)
        return
      }

      const updatedTags = tags.map((tag) =>
        tag.thread === activeTagThread && tag.group === fromGroup
          ? { ...tag, group: trimmedGroup }
          : tag,
      )

      dsb$.commit({
        tags: updatedTags,
        original: { ...dsb$.original, tags: updatedTags },
      })
    } finally {
      dsb$.commit({ saving: false })
    }
  }

  return {
    loadTags,
    createTag,
    updateTag,
    renameGroup,
    moveTag,
    moveTag2Edge,
  }
}
