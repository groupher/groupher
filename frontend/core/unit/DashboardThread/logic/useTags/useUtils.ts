import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'

import { COLOR } from '~/const/colors'
import { THREAD } from '~/const/thread'
import { browserQuery } from '~/graphql/client'
import type { TColorName, TTag, TTagGroup, TThread } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import S from '~/unit/DashboardThread/schema/tags'
import { slugify } from '~/utils/slug'

type TCommunityTagGroupsResult = ResultOf<typeof S.communityTagGroups>
type TUpdateCommunityTagVariables = VariablesOf<typeof S.updateCommunityTag>

type TRet = {
  loadTags: (thread?: TThread) => void
  createGroup: (title: string) => Promise<void>
  createTag: (title: string, groupId: string, color?: TColorName) => Promise<void>
  updateTag: (tag: TTag) => Promise<void>
  renameGroup: (groupId: string, toGroup: string) => Promise<void>
  commitTagSorting: (tagGroups: TTagGroup[]) => void
}

/** Exposes utils state and actions through the shared React hook boundary. */
export default function useUtils(): TRet {
  const dsb$ = useDashboard()
  const community$ = useCommunity()

  const { original } = dsb$

  const loadTags = (activeThread: TThread = THREAD.POST): void => {
    const community = community$.slug
    const thread = activeThread

    const params = { community, thread }

    dsb$.commit({ loading: true })
    browserQuery(S.communityTagGroups, params).then((data) => {
      const tagGroups = (data.communityTagGroups ?? []).map((group) => ({
        ...group,
        tags: (group.tags ?? []).map((tag) => ({
          ...tag,
          thread: tag.thread as TThread,
        })),
      })) as TCommunityTagGroupsResult['communityTagGroups'] as TTagGroup[]
      dsb$.commit({ tagGroups, original: { ...original, tagGroups }, loading: false })
    })
  }

  const createGroup = async (title: string): Promise<void> => {
    const { activeTagThread } = dsb$
    const thread = activeTagThread || THREAD.POST
    const trimmedTitle = title.trim()

    if (!trimmedTitle) return

    dsb$.commit({ saving: true })

    try {
      await browserQuery(S.createCommunityTagGroup, {
        thread,
        title: trimmedTitle,
        community: community$.slug,
      })
      loadTags(thread)
    } finally {
      dsb$.commit({ saving: false })
    }
  }

  const createTag = async (
    title: string,
    groupId: string,
    color: TColorName = COLOR.BLACK,
  ): Promise<void> => {
    const { activeTagThread } = dsb$
    const thread = activeTagThread || THREAD.POST
    const trimmedTitle = title.trim()

    if (!trimmedTitle || !groupId) return

    dsb$.commit({ saving: true })

    try {
      const slug = await slugify(trimmedTitle)

      await browserQuery(S.createCommunityTag, {
        thread,
        title: trimmedTitle,
        slug,
        layout: null,
        color,
        groupId,
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

      await browserQuery<unknown, TUpdateCommunityTagVariables>(S.updateCommunityTag, {
        ...nextTag,
        id: tag.id,
        community: community$.slug,
      } as TUpdateCommunityTagVariables)

      const updatedTagGroups = dsb$.tagGroups.map((group) => ({
        ...group,
        tags: group.tags.map((item) => (item.id === tag.id ? nextTag : item)),
      }))

      dsb$.commit({
        tagGroups: updatedTagGroups,
        editingTag: null,
        original: { ...dsb$.original, tagGroups: updatedTagGroups },
      })
    } finally {
      dsb$.commit({ saving: false })
    }
  }

  const commitTagSorting = (tagGroups: TTagGroup[]): void => {
    dsb$.commit({ tagGroups })
  }

  const renameGroup = async (groupId: string, toGroup: string): Promise<void> => {
    const { activeTagThread, tagGroups } = dsb$
    const community = community$.slug
    const trimmedGroup = toGroup.trim()
    const targetGroup = tagGroups.find((group) => group.id === groupId)

    if (!activeTagThread || !targetGroup || !trimmedGroup || trimmedGroup === targetGroup.title) {
      return
    }

    dsb$.commit({ saving: true })

    try {
      await browserQuery(S.updateCommunityTagGroup, {
        id: groupId,
        community,
        thread: activeTagThread,
        title: trimmedGroup,
      })

      const updatedGroups = tagGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              title: trimmedGroup,
              tags: group.tags.map((tag) => ({ ...tag, group: trimmedGroup })),
            }
          : group,
      )

      dsb$.commit({
        tagGroups: updatedGroups,
        original: { ...dsb$.original, tagGroups: updatedGroups },
      })
    } finally {
      dsb$.commit({ saving: false })
    }
  }

  return {
    loadTags,
    createGroup,
    createTag,
    updateTag,
    renameGroup,
    commitTagSorting,
  }
}
