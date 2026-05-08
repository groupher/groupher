import { COLOR } from '~/const/colors'
import { THREAD } from '~/const/thread'
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
  commitTagSorting: (threadTags: TTag[]) => void
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

  const commitTagSorting = (threadTags: TTag[]): void => {
    const { activeTagThread, tags } = dsb$

    if (!activeTagThread) return

    const restTags = tags.filter((tag) => tag.thread !== activeTagThread)
    dsb$.commit({ tags: [...restTags, ...threadTags] })
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
    commitTagSorting,
  }
}
