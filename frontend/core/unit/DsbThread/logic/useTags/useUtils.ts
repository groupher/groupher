import type { VariablesOf } from '@graphql-typed-document-node/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { COLOR } from '~/const/colors'
import { THREAD } from '~/const/thread'
import { browserGraphQLRequest } from '~/graphql/client'
import { Q } from '~/query'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import type { TColorName, TTag, TTagGroup, TThread } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDsbEdit from '~/stores/dsbEdit/hooks'
import { useTagEditorUi } from '~/stores/dsbEditorUi/hooks'
import S from '~/unit/DsbThread/schema/tags'
import { slugify } from '~/utils/slug'

type TUpdateCommunityTagVariables = VariablesOf<typeof S.updateCommunityTag>

type TRet = {
  loadTags: (thread?: TThread) => void
  loading: boolean
  createGroup: (title: string) => Promise<void>
  createTag: (title: string, groupId: string, color?: TColorName) => Promise<void>
  updateTag: (tag: TTag) => Promise<void>
  renameGroup: (groupId: string, toGroup: string) => Promise<void>
  commitTagSorting: (tagGroups: TTagGroup[]) => void
  saving: boolean
}

/** Exposes utils state and actions through the shared React hook boundary. */
export default function useUtils(): TRet {
  const dsb$ = useDsbEdit()
  const tagUi$ = useTagEditorUi()
  const community$ = useCommunity()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const invalidateTags = (thread: TThread): void => {
    void invalidate(queryClient, QueryInvalidation.article.tagGroups(community$.slug, thread))
  }
  const confirmTagGroups = (tagGroups: readonly TTagGroup[]): void => {
    const confirmed = { tagGroups }
    dsb$.reconcile({ fields: ['tagGroups'], submitted: confirmed, confirmed })
  }
  const createGroupMutation = useMutation({
    mutationKey: ['dsb', 'tag-group-create', community$.slug],
    mutationFn: ({ title, thread }: { title: string; thread: TThread }) =>
      executeCommand({
        request: (variables) => browserGraphQLRequest(S.createCommunityTagGroup, variables),
        variables: { thread, title, community: community$.slug },
      }),
    onSuccess: (_data, { thread }) => {
      invalidateTags(thread)
    },
  })
  const createTagMutation = useMutation({
    mutationKey: ['dsb', 'tag-create', community$.slug],
    mutationFn: (input: {
      thread: TThread
      title: string
      slug: string
      layout: null
      groupId: string
      color: TColorName
    }) =>
      executeCommand({
        request: (variables) => browserGraphQLRequest(S.createCommunityTag, variables),
        variables: { ...input, community: community$.slug },
      }),
    onSuccess: (_data, { thread }) => {
      invalidateTags(thread)
    },
  })
  const updateTagMutation = useMutation({
    mutationKey: ['dsb', 'tag-update', community$.slug],
    mutationFn: async ({ tag, thread }: { tag: TTag; thread: TThread }) => {
      const title = tag.title.trim()
      const slug = await slugify(title)
      const nextTag = { ...tag, title, slug }
      await executeCommand<TUpdateCommunityTagVariables, unknown>({
        request: (variables) => browserGraphQLRequest(S.updateCommunityTag, variables),
        variables: {
          ...nextTag,
          id: tag.id,
          community: community$.slug,
        } as Omit<TUpdateCommunityTagVariables, 'commandId'>,
      })
      return { nextTag, thread }
    },
    onSuccess: ({ nextTag, thread }) => {
      invalidateTags(thread)
      const updatedTagGroups = dsb$.tagGroups.map((group) => ({
        ...group,
        tags: group.tags.map((item) => (item.id === nextTag.id ? nextTag : item)),
      }))
      confirmTagGroups(updatedTagGroups)
      tagUi$.patch({ editingTag: null })
    },
  })
  const renameGroupMutation = useMutation({
    mutationKey: ['dsb', 'tag-group-update', community$.slug],
    mutationFn: ({ groupId, title, thread }: { groupId: string; title: string; thread: TThread }) =>
      executeCommand({
        request: (variables) => browserGraphQLRequest(S.updateCommunityTagGroup, variables),
        variables: {
          id: groupId,
          community: community$.slug,
          thread,
          title,
        },
      }),
    onSuccess: (_data, { thread }) => {
      invalidateTags(thread)
    },
  })

  const loadTags = (activeThread: TThread = THREAD.POST): void => {
    const community = community$.slug
    const thread = activeThread

    setLoading(true)
    void queryClient
      .fetchQuery(Q.article.tagGroups(community, thread))
      .then((tagGroups) => {
        const normalizedTagGroups = tagGroups.map((group) => ({
          ...group,
          tags: group.tags.map((tag) => ({
            ...tag,
            thread: tag.thread as TThread,
          })),
        }))
        confirmTagGroups(normalizedTagGroups)
      })
      .catch((error) => console.error('## load tag groups error: ', error))
      .finally(() => setLoading(false))
  }

  const createGroup = async (title: string): Promise<void> => {
    const { activeTagThread } = dsb$
    const thread = activeTagThread || THREAD.POST
    const trimmedTitle = title.trim()

    if (!trimmedTitle) return

    await createGroupMutation.mutateAsync({ title: trimmedTitle, thread })
    loadTags(thread)
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

    const slug = await slugify(trimmedTitle)

    await createTagMutation.mutateAsync({
      thread,
      title: trimmedTitle,
      slug,
      layout: null,
      color,
      groupId,
    })

    loadTags(thread)
  }

  const updateTag = async (tag: TTag): Promise<void> => {
    const title = tag.title?.trim()

    if (!tag.id || !title) return

    await updateTagMutation.mutateAsync({ tag, thread: dsb$.activeTagThread || THREAD.POST })
  }

  const commitTagSorting = (tagGroups: TTagGroup[]): void => {
    dsb$.editMany({ tagGroups })
  }

  const renameGroup = async (groupId: string, toGroup: string): Promise<void> => {
    const { activeTagThread, tagGroups } = dsb$
    const trimmedGroup = toGroup.trim()
    const targetGroup = tagGroups.find((group) => group.id === groupId)

    if (!activeTagThread || !targetGroup || !trimmedGroup || trimmedGroup === targetGroup.title) {
      return
    }

    await renameGroupMutation.mutateAsync({
      groupId,
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

    confirmTagGroups(updatedGroups)
  }

  return {
    loadTags,
    loading,
    createGroup,
    createTag,
    updateTag,
    renameGroup,
    commitTagSorting,
    saving:
      createGroupMutation.isPending ||
      createTagMutation.isPending ||
      updateTagMutation.isPending ||
      renameGroupMutation.isPending,
  }
}
