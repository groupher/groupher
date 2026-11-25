import type { VariablesOf } from '@graphql-typed-document-node/core'
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'

import { COLOR } from '~/const/colors'
import { browserGraphQLRequest } from '~/graphql/client'
import { dsbMutationKeys, Q } from '~/query'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import type { TColorName, TTag, TTagGroup, TThread } from '~/spec'
import { useDsbShellSession } from '~/stores/dsbShell/hooks'
import S from '~/unit/DsbThread/schema/tags'
import {
  applyTagSortOrder,
  tagSortOrderFromGroups,
  type TTagSortOrder,
} from '~/unit/DsbThread/Tags/store'
import { demoTagGroupsQueryKey, writeDemoTagGroups } from '~/unit/DsbThread/Tags/store/demo'
import useTagsEditor from '~/unit/DsbThread/Tags/store/hooks'
import { slugify } from '~/utils/slug'

type TUpdateCommunityTagVariables = VariablesOf<typeof S.updateCommunityTag>
type TCreateCommunityTagVariables = VariablesOf<typeof S.createCommunityTag>
type TDeleteCommunityTagVariables = VariablesOf<typeof S.deleteCommunityTag>

type TUpdateSession = { source: 'inline' | 'form'; id: number }

type TRet = {
  createGroup: (title: string) => Promise<void>
  createTag: (title: string, groupId: string, color?: TColorName) => Promise<void>
  createTagFromForm: (tag: TTag, session: number) => Promise<void>
  updateTag: (tag: TTag, session?: TUpdateSession) => Promise<void>
  deleteTag: (tag: TTag, session: number) => Promise<void>
  renameGroup: (groupId: string, toGroup: string) => Promise<void>
  commitTagSorting: (tagGroups: TTagGroup[]) => void
  saveTagSorting: (tagGroups: readonly TTagGroup[]) => Promise<void>
  resetTagSorting: () => void
  hasSortingChanges: boolean
  saving: boolean
}

/** Exposes Tags domain commands while confirmed groups remain in TanStack Query. */
export default function useUtils(
  confirmedTagGroups: readonly TTagGroup[],
  activeThread: TThread,
): TRet {
  const tagsEditor = useTagsEditor()
  const queryClient = useQueryClient()
  const { demoMode } = useDsbShellSession()
  const community = tagsEditor.community
  const invalidateTags = (targetCommunity: string, thread: TThread) =>
    invalidate(queryClient, QueryInvalidation.article.tagGroups(targetCommunity, thread))

  const createGroupMutation = useMutation({
    mutationKey: dsbMutationKeys.tagGroupCreate(community),
    mutationFn: ({
      community: targetCommunity,
      title,
      thread,
    }: {
      community: string
      title: string
      thread: TThread
    }) =>
      executeCommand({
        request: (variables) => browserGraphQLRequest(S.createCommunityTagGroup, variables),
        variables: { thread, title, community: targetCommunity },
      }),
    onSuccess: (_data, { community: targetCommunity, thread }) =>
      invalidateTags(targetCommunity, thread),
  })

  const createTagMutation = useMutation({
    mutationKey: dsbMutationKeys.tagCreate(community),
    mutationFn: async ({
      community: targetCommunity,
      tag,
      thread,
    }: {
      community: string
      tag: TTag
      thread: TThread
    }) => {
      const title = (tag.title ?? '').trim()
      const slug = tag.slug?.trim() || (await slugify(title))
      await executeCommand<TCreateCommunityTagVariables, unknown>({
        request: (variables) => browserGraphQLRequest(S.createCommunityTag, variables),
        variables: {
          thread,
          title,
          slug,
          layout: tag.layout ?? null,
          color: (tag.color || COLOR.BLACK) as TColorName,
          groupId: tag.groupId ?? '',
          community: targetCommunity,
          marker: tag.marker,
        } as Omit<TCreateCommunityTagVariables, 'commandId'>,
      })

      return { community: targetCommunity, thread }
    },
    onSuccess: ({ community: targetCommunity, thread }) => invalidateTags(targetCommunity, thread),
  })

  const updateTagMutation = useMutation({
    mutationKey: dsbMutationKeys.tagUpdate(community),
    mutationFn: async ({
      community: targetCommunity,
      tag,
      thread,
      session,
    }: {
      community: string
      tag: TTag
      thread: TThread
      session?: TUpdateSession
    }) => {
      const title = (tag.title ?? '').trim()
      const slug =
        session?.source === 'inline' || !tag.slug?.trim() ? await slugify(title) : tag.slug.trim()
      const nextTag = { ...tag, title, slug }
      await executeCommand<TUpdateCommunityTagVariables, unknown>({
        request: (variables) => browserGraphQLRequest(S.updateCommunityTag, variables),
        variables: {
          id: tag.id,
          color: tag.color,
          title,
          slug,
          layout: tag.layout,
          desc: tag.desc,
          community: targetCommunity,
          groupId: tag.groupId,
          marker: tag.marker,
        } as Omit<TUpdateCommunityTagVariables, 'commandId'>,
      })

      return { community: targetCommunity, thread, nextTag, session }
    },
    onSuccess: ({ community: targetCommunity, thread }) => invalidateTags(targetCommunity, thread),
  })

  const deleteTagMutation = useMutation({
    mutationKey: dsbMutationKeys.tagUpdate(community),
    mutationFn: async ({
      community: targetCommunity,
      id,
      thread,
    }: {
      community: string
      id: string
      thread: TThread
    }) => {
      await executeCommand<TDeleteCommunityTagVariables, unknown>({
        request: (variables) => browserGraphQLRequest(S.deleteCommunityTag, variables),
        variables: { id, community: targetCommunity, thread } as Omit<
          TDeleteCommunityTagVariables,
          'commandId'
        >,
      })

      return { community: targetCommunity, thread }
    },
    onSuccess: ({ community: targetCommunity, thread }) => invalidateTags(targetCommunity, thread),
  })

  const renameGroupMutation = useMutation({
    mutationKey: dsbMutationKeys.tagGroupUpdate(community),
    mutationFn: ({
      community: targetCommunity,
      groupId,
      title,
      thread,
    }: {
      community: string
      groupId: string
      title: string
      thread: TThread
    }) =>
      executeCommand({
        request: (variables) => browserGraphQLRequest(S.updateCommunityTagGroup, variables),
        variables: { id: groupId, community: targetCommunity, thread, title },
      }),
    onSuccess: (_data, { community: targetCommunity, thread }) =>
      invalidateTags(targetCommunity, thread),
  })

  const saveSortingMutation = useMutation({
    mutationKey: dsbMutationKeys.tagGroupUpdate(community),
    mutationFn: async ({
      community: targetCommunity,
      thread,
      groups,
      tags,
    }: {
      community: string
      thread: TThread
      groups: { id: string; index: number }[]
      tags: { id: string; groupId: string; index: number }[]
    }) => {
      await Promise.all([
        executeCommand({
          request: (variables) => browserGraphQLRequest(S.reindexCommunityTagGroups, variables),
          variables: { community: targetCommunity, thread, groups },
        }),
        executeCommand({
          request: (variables) => browserGraphQLRequest(S.reindexCommunityTags, variables),
          variables: { community: targetCommunity, thread, tags },
        }),
      ])
    },
    onSettled: (_data, _error, { community: targetCommunity, thread }) =>
      invalidateTags(targetCommunity, thread),
  })

  const updateDemoGroups = (
    targetCommunity: string,
    thread: TThread,
    fallback: readonly TTagGroup[],
    update: (groups: readonly TTagGroup[]) => TTagGroup[],
  ): TTagGroup[] => {
    const queryKey = demoTagGroupsQueryKey(targetCommunity, thread)
    const current = queryClient.getQueryData<TTagGroup[]>(queryKey) ?? [...fallback]
    const next = update(current)
    queryClient.setQueryData(queryKey, next)
    writeDemoTagGroups(targetCommunity, thread, next)
    return next
  }

  const localId = (kind: 'group' | 'tag'): string => {
    const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    return `demo-${kind}:${suffix}`
  }

  const createGroup = async (title: string): Promise<void> => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const targetCommunity = community
    const thread = activeThread
    if (demoMode) {
      updateDemoGroups(targetCommunity, thread, confirmedTagGroups, (groups) => [
        {
          id: localId('group'),
          title: trimmedTitle,
          index: 0,
          tags: [],
        },
        ...groups.map((group, index) => ({ ...group, index: index + 1 })),
      ])
      return
    }

    await createGroupMutation.mutateAsync({
      community: targetCommunity,
      title: trimmedTitle,
      thread,
    })
  }

  const createTag = async (
    title: string,
    groupId: string,
    color: TColorName = COLOR.BLACK,
  ): Promise<void> => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle || !groupId) return

    const targetCommunity = community
    const thread = activeThread
    if (demoMode) {
      const slug = await slugify(trimmedTitle)
      const tag = {
        id: localId('tag'),
        title: trimmedTitle,
        slug,
        groupId,
        thread,
        color,
        index: 0,
      } as TTag
      updateDemoGroups(targetCommunity, thread, confirmedTagGroups, (groups) =>
        groups.map((group) =>
          group.id === groupId
            ? { ...group, tags: [...group.tags, { ...tag, index: group.tags.length }] }
            : group,
        ),
      )
      return
    }

    await createTagMutation.mutateAsync({
      community: targetCommunity,
      thread,
      tag: { title: trimmedTitle, groupId, color, thread } as TTag,
    })
  }

  const createTagFromForm = async (tag: TTag, session: number): Promise<void> => {
    const title = tag.title?.trim()
    if (!title || !tag.groupId) return
    const editorStore = tagsEditor.store
    if (editorStore.tagFormSession !== session || editorStore.tagFormMode !== 'create') return

    const thread = tag.thread ?? activeThread
    const targetCommunity = tagsEditor.community
    if (demoMode) {
      const slug = tag.slug?.trim() || (await slugify(title))
      if (editorStore.tagFormSession !== session || editorStore.tagFormMode !== 'create') return
      const nextTag = { ...tag, id: localId('tag'), title, slug, thread } as TTag
      updateDemoGroups(targetCommunity, thread, confirmedTagGroups, (groups) =>
        groups.map((group) =>
          group.id === nextTag.groupId
            ? { ...group, tags: [...group.tags, { ...nextTag, index: group.tags.length }] }
            : group,
        ),
      )
      return
    }

    await createTagMutation.mutateAsync({
      community: targetCommunity,
      thread,
      tag: { ...tag, title },
    })
  }

  const updateTag = async (tag: TTag, session?: TUpdateSession): Promise<void> => {
    const title = tag.title?.trim()
    if (!tag.id || !title) return

    const editorStore = tagsEditor.store
    if (session?.source === 'inline') {
      if (
        editorStore.inlineEditSession !== session.id ||
        editorStore.inlineTagDraft?.id !== tag.id
      ) {
        return
      }
    }
    if (session?.source === 'form') {
      if (editorStore.tagFormSession !== session.id || editorStore.tagFormDraft?.id !== tag.id) {
        return
      }
    }

    if (demoMode) {
      const thread = tag.thread ?? activeThread
      const targetCommunity = tagsEditor.community
      const slug =
        session?.source === 'inline' || !tag.slug?.trim() ? await slugify(title) : tag.slug.trim()
      if (session?.source === 'inline') {
        if (
          editorStore.inlineEditSession !== session.id ||
          editorStore.inlineTagDraft?.id !== tag.id
        ) {
          return
        }
      }
      if (session?.source === 'form') {
        if (editorStore.tagFormSession !== session.id || editorStore.tagFormDraft?.id !== tag.id) {
          return
        }
      }
      const nextTag = { ...tag, title, slug, thread }
      updateDemoGroups(targetCommunity, thread, confirmedTagGroups, (groups) => {
        const oldGroupId = groups.find((group) => group.tags.some((item) => item.id === tag.id))?.id
        return groups.map((group) => {
          if (group.id === oldGroupId && group.id !== nextTag.groupId) {
            return { ...group, tags: group.tags.filter((item) => item.id !== tag.id) }
          }
          if (group.id === nextTag.groupId) {
            const exists = group.tags.some((item) => item.id === tag.id)
            const tags = exists
              ? group.tags.map((item) => (item.id === tag.id ? nextTag : item))
              : [...group.tags, { ...nextTag, index: group.tags.length }]
            return { ...group, tags }
          }
          return group
        })
      })
      if (
        session?.source === 'inline' &&
        editorStore.inlineEditSession === session.id &&
        editorStore.inlineTagDraft?.id === tag.id
      ) {
        editorStore.clearInlineEdit(session.id)
      }
      return
    }

    await updateTagMutation.mutateAsync({
      community: tagsEditor.community,
      tag,
      thread: tag.thread ?? activeThread,
      session,
    })

    if (
      session?.source === 'inline' &&
      editorStore.inlineEditSession === session.id &&
      editorStore.inlineTagDraft?.id === tag.id
    ) {
      editorStore.clearInlineEdit(session.id)
    }
  }

  const deleteTag = async (tag: TTag, session: number): Promise<void> => {
    if (!tag.id) return
    const editorStore = tagsEditor.store
    if (editorStore.tagFormSession !== session || editorStore.tagFormDraft?.id !== tag.id) return
    const targetCommunity = tagsEditor.community
    const thread = tag.thread ?? activeThread
    if (demoMode) {
      updateDemoGroups(targetCommunity, thread, confirmedTagGroups, (groups) =>
        groups.map((group) => ({
          ...group,
          tags: group.tags.filter((item) => item.id !== tag.id),
        })),
      )
      return
    }

    await deleteTagMutation.mutateAsync({ community: targetCommunity, id: tag.id, thread })
  }

  const commitTagSorting = (tagGroups: TTagGroup[]): void => {
    tagsEditor.store.setSortingDraft(activeThread, tagSortOrderFromGroups(tagGroups))
  }

  const saveTagSorting = async (tagGroups: readonly TTagGroup[]): Promise<void> => {
    const editorStore = tagsEditor.store
    const submitted: TTagSortOrder =
      editorStore.getSortingDraft(activeThread) ?? tagSortOrderFromGroups(tagGroups)
    if (!editorStore.hasSortingChanges(activeThread)) return

    const targetCommunity = tagsEditor.community
    const thread = activeThread
    if (demoMode) {
      const sortedGroups = applyTagSortOrder(confirmedTagGroups, submitted)
      updateDemoGroups(targetCommunity, thread, confirmedTagGroups, () => sortedGroups)
      editorStore.reconcileSorting(thread, submitted, tagSortOrderFromGroups(sortedGroups))
      return
    }

    const sortedGroups = applyTagSortOrder(confirmedTagGroups, submitted)
    const groups = sortedGroups.map((group, index) => ({ id: group.id, index }))
    const tags = sortedGroups.flatMap((group) =>
      group.tags.flatMap((tag, index) =>
        tag.id ? [{ id: tag.id, groupId: group.id, index }] : [],
      ),
    )
    await saveSortingMutation.mutateAsync({ community: targetCommunity, thread, groups, tags })
    const confirmed = await queryClient.fetchQuery({
      ...Q.article.tagGroups(targetCommunity, thread),
      staleTime: 0,
    })
    editorStore.reconcileSorting(thread, submitted, tagSortOrderFromGroups(confirmed))
  }

  const renameGroup = async (groupId: string, toGroup: string): Promise<void> => {
    const trimmedGroup = toGroup.trim()
    const targetGroup = confirmedTagGroups.find((group) => group.id === groupId)
    if (!targetGroup || !trimmedGroup || trimmedGroup === targetGroup.title) return

    if (demoMode) {
      updateDemoGroups(community, activeThread, confirmedTagGroups, (groups) =>
        groups.map((group) => (group.id === groupId ? { ...group, title: trimmedGroup } : group)),
      )
      return
    }

    await renameGroupMutation.mutateAsync({
      community,
      groupId,
      thread: activeThread,
      title: trimmedGroup,
    })
  }

  const pendingGroupCreate = useIsMutating({
    mutationKey: dsbMutationKeys.tagGroupCreate(community),
  })
  const pendingTagCreate = useIsMutating({ mutationKey: dsbMutationKeys.tagCreate(community) })
  const pendingTagUpdate = useIsMutating({ mutationKey: dsbMutationKeys.tagUpdate(community) })
  const pendingGroupUpdate = useIsMutating({
    mutationKey: dsbMutationKeys.tagGroupUpdate(community),
  })
  const saving =
    pendingGroupCreate > 0 || pendingTagCreate > 0 || pendingTagUpdate > 0 || pendingGroupUpdate > 0

  return {
    createGroup,
    createTag,
    createTagFromForm,
    updateTag,
    deleteTag,
    renameGroup,
    commitTagSorting,
    saveTagSorting,
    resetTagSorting: () => tagsEditor.store.resetSorting(activeThread),
    hasSortingChanges: tagsEditor.store.hasSortingChanges(activeThread),
    saving,
  }
}
