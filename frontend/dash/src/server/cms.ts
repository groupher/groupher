import type { ResultOf } from '@graphql-typed-document-node/core'
import { createServerFn } from '@tanstack/react-start'

import { THREAD } from '~/const/thread'
import { themePresets } from '~/schemas/pages/misc'
import { ticketInternal } from '~/schemas/pages/ticket'
import type {
  TPagiGraphQLInput,
  TPagedArticles,
  TPagedTickets,
  TTagGroup,
  TThemePresetOption,
} from '~/spec'
import type { TPagedAssets } from '~/unit/DsbThread/AssetsHub/spec'
import type { TRawPagedTrashedPosts } from '~/unit/DsbThread/CMS/Trash/spec'
import DashboardAssetsSchema from '~/unit/DsbThread/schema/assets'
import DashboardContentSchema from '~/unit/DsbThread/schema/content'
import DashboardTagsSchema from '~/unit/DsbThread/schema/tags'
import KanbanSchema from '~/unit/KanbanThread/schema'

import { fetchGraphQL, getAuthToken, setPrivateCacheHeader } from './graphql'

type TGroupedKanban = {
  todo: TPagedTickets
  wip: TPagedTickets
  done: TPagedTickets
}

export type TPagedPostsInput = {
  pagi: TPagiGraphQLInput
  community: string
  page?: number
}

export const loadPagedPosts = createServerFn({ method: 'GET', strict: false })
  .validator((data: TPagedPostsInput) => data)
  .handler(async ({ data }): Promise<TPagedArticles | null> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    const result = await fetchGraphQL(
      DashboardContentSchema.postPage,
      {
        filter: { community: data.community },
        pagi: data.pagi,
      },
      token,
    )

    return (result.data?.postPage as unknown as TPagedArticles | null) || null
  })

export const loadPagedChangelogs = createServerFn({ method: 'GET', strict: false })
  .validator((data: TPagedPostsInput) => data)
  .handler(async ({ data }): Promise<TPagedArticles | null> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    const result = await fetchGraphQL(
      DashboardContentSchema.changelogPage,
      {
        filter: { community: data.community },
        pagi: data.pagi,
      },
      token,
    )

    return (result.data?.changelogPage as unknown as TPagedArticles | null) || null
  })

export type TKanbanInput = {
  community: string
  pagi: TPagiGraphQLInput
}

export const loadKanban = createServerFn({ method: 'GET', strict: false })
  .validator((data: TKanbanInput) => data)
  .handler(async ({ data }): Promise<TGroupedKanban | null> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    const result = await fetchGraphQL(
      KanbanSchema.ticketKanbanInternal,
      { community: data.community, pagi: data.pagi },
      token,
    )

    return (result.data?.ticketKanbanInternal as unknown as TGroupedKanban | null) ?? null
  })

/** Loads a private Ticket through the authenticated Dash server transport. */
export const loadTicketInternal = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; id: string }) => data)
  .handler(async ({ data }) => {
    setPrivateCacheHeader()
    const result = await fetchGraphQL<ResultOf<typeof ticketInternal>>(
      ticketInternal,
      data,
      getAuthToken(),
    )
    return result.data?.ticketInternal ?? null
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

    const result = await fetchGraphQL<ResultOf<typeof DashboardTagsSchema.communityTagGroups>>(
      DashboardTagsSchema.communityTagGroups,
      { community: data.community, thread: data.thread || THREAD.POST },
      token,
    )

    return (result.data?.communityTagGroups as unknown as TTagGroup[] | null) ?? null
  })

export type TTrashInput = {
  community: string
  page?: number
}

export const loadTrash = createServerFn({ method: 'GET', strict: false })
  .validator((data: TTrashInput) => data)
  .handler(async ({ data }): Promise<TRawPagedTrashedPosts | null> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    const result = await fetchGraphQL(
      DashboardContentSchema.trashedPosts,
      { community: data.community, pagi: { offset: { page: data.page || 1, size: 20 } } },
      token,
    )

    const trashedArticles = result.data?.trashedArticles as unknown as TRawPagedTrashedPosts | null
    if (!trashedArticles) {
      return null
    }

    return trashedArticles
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

    const result = await fetchGraphQL(
      DashboardAssetsSchema.pagedCommunityAssets,
      { community: data.community, pagi: { offset: { page: data.page || 1, size: 20 } } },
      token,
    )

    return (result.data?.pagedCommunityAssets as unknown as TPagedAssets | null) ?? null
  })

export const loadThemePresets = createServerFn({ method: 'GET', strict: false })
  .validator(() => ({}))
  .handler(async (): Promise<TThemePresetOption[]> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    const result = await fetchGraphQL(themePresets, {}, token)
    const presets = result.data?.themePresets || []

    return presets.map((preset) => ({
      value: preset.value as TThemePresetOption['value'],
      tokens: preset.tokens as TThemePresetOption['tokens'],
    }))
  })
