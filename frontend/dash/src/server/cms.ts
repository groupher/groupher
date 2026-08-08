import { createServerFn } from '@tanstack/react-start'
import { print, type DocumentNode } from 'graphql'

import { THREAD } from '~/const/thread'
import { P } from '~/schemas'
import type { TPagedArticles, TTagGroup, TThemePresetOption, TThemePresetsQuery } from '~/spec'
import type { TPagedAssets } from '~/unit/DashboardThread/AssetsHub/spec'
import type { TPagedTrashedPosts, TTrashedPost } from '~/unit/DashboardThread/CMS/Trash/spec'
import DashboardSchema from '~/unit/DashboardThread/schema'
import KanbanSchema from '~/unit/KanbanThread/schema'

import { fetchGraphQL, getAuthToken, setPrivateCacheHeader } from './graphql'

type TGroupedKanban = {
  backlog: TPagedArticles
  todo: TPagedArticles
  wip: TPagedArticles
  done: TPagedArticles
  rejected: TPagedArticles
}

type TPagedArticlesQuery = {
  pagedPosts?: TPagedArticles | null
  pagedChangelogs?: TPagedArticles | null
}

type TGroupedKanbanPostsQuery = {
  groupedKanbanPosts?: TGroupedKanban | null
}

type TTagGroupsQuery = {
  communityTagGroups?: TTagGroup[] | null
}

type TTrashedPostsQuery = {
  trashedArticles?: TPagedTrashedPosts | null
}

type TPagedAssetsQuery = {
  pagedCommunityAssets?: TPagedAssets | null
}

const toQuery = (document: DocumentNode | string): string =>
  typeof document === 'string' ? document : print(document)

const fetchPaged = async (
  query: string,
  variables: Record<string, unknown>,
): Promise<TPagedArticles | null> => {
  const token = getAuthToken()
  setPrivateCacheHeader()

  const result = await fetchGraphQL<Record<string, TPagedArticles | null>>(query, variables, token)

  return Object.values(result.data ?? {})[0] ?? null
}

export type TPagedPostsInput = {
  community: string
  page?: number
}

export const loadPagedPosts = createServerFn({ method: 'GET', strict: false })
  .validator((data: TPagedPostsInput) => data)
  .handler(async ({ data }): Promise<TPagedArticles | null> => {
    const payload = await fetchPaged(toQuery(DashboardSchema.pagedPosts), {
      filter: { page: data.page || 1, size: 20, community: data.community },
      userHasLogin: false,
    })

    return (payload as TPagedArticlesQuery['pagedPosts']) || null
  })

export const loadPagedChangelogs = createServerFn({ method: 'GET', strict: false })
  .validator((data: TPagedPostsInput) => data)
  .handler(async ({ data }): Promise<TPagedArticles | null> => {
    const payload = await fetchPaged(toQuery(DashboardSchema.pagedChangelogs), {
      filter: { page: data.page || 1, size: 20, community: data.community },
      userHasLogin: false,
    })

    return (payload as TPagedArticlesQuery['pagedChangelogs']) || null
  })

export type TKanbanInput = {
  community: string
}

export const loadKanban = createServerFn({ method: 'GET', strict: false })
  .validator((data: TKanbanInput) => data)
  .handler(async ({ data }): Promise<TGroupedKanban | null> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    const result = await fetchGraphQL<TGroupedKanbanPostsQuery>(
      toQuery(KanbanSchema.groupedKanbanPosts),
      { community: data.community },
      token,
    )

    return result.data?.groupedKanbanPosts ?? null
  })

export type TTagGroupsInput = {
  community: string
  thread?: string
}

export const loadTagGroups = createServerFn({ method: 'GET', strict: false })
  .validator((data: TTagGroupsInput) => data)
  .handler(async ({ data }): Promise<TTagGroup[] | null> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    const result = await fetchGraphQL<TTagGroupsQuery>(
      toQuery(DashboardSchema.communityTagGroups),
      { community: data.community, thread: data.thread || THREAD.POST },
      token,
    )

    return result.data?.communityTagGroups ?? null
  })

export type TTrashInput = {
  community: string
  page?: number
}

export const loadTrash = createServerFn({ method: 'GET', strict: false })
  .validator((data: TTrashInput) => data)
  .handler(async ({ data }): Promise<TPagedTrashedPosts | null> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    const result = await fetchGraphQL<TTrashedPostsQuery>(
      toQuery(DashboardSchema.trashedPosts),
      { community: data.community, page: data.page || 1, size: 20 },
      token,
    )

    const trashedArticles = result.data?.trashedArticles
    if (!trashedArticles) {
      return null
    }

    return {
      ...trashedArticles,
      entries:
        (trashedArticles.entries as readonly TTrashedPost[])?.map((entry) => ({ ...entry })) || [],
    }
  })

export type TAssetsInput = {
  community: string
  page?: number
}

export const loadAssets = createServerFn({ method: 'GET', strict: false })
  .validator((data: TAssetsInput) => data)
  .handler(async ({ data }): Promise<TPagedAssets | null> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    const result = await fetchGraphQL<TPagedAssetsQuery>(
      toQuery(DashboardSchema.pagedCommunityAssets),
      { community: data.community, filter: { page: data.page || 1, size: 20 } },
      token,
    )

    return result.data?.pagedCommunityAssets ?? null
  })

export const loadThemePresets = createServerFn({ method: 'GET', strict: false })
  .validator(() => ({}))
  .handler(async (): Promise<TThemePresetOption[]> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    const result = await fetchGraphQL<TThemePresetsQuery>(toQuery(P.themePresets), {}, token)
    const presets = result.data?.themePresets || []

    return presets.map((preset) => ({
      value: preset.value,
      tokens: preset.tokens,
    }))
  })
