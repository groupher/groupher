import type { VariablesOf } from '@graphql-typed-document-node/core'
import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAG } from '~/const/cache'
import { LOCALE } from '~/const/i18n'
import { TAG_THREADS, THREAD } from '~/const/thread'
import { publicQuery } from '~/graphql/server'
import type { TI18nNamespace } from '~/i18n'
import { loadLocaleFile } from '~/i18n'
import { stripPagedCommentViewerState } from '~/lib/commentViewerState'
import { changelog as changelogQuery, pagedChangelogs } from '~/schemas/pages/changelog'
import { pagedComments } from '~/schemas/pages/comment'
import { community as communityQuery } from '~/schemas/pages/community'
import { doc as docQuery, docPublicTree } from '~/schemas/pages/doc'
import { communityTagGroups, communityTagStats, themePresets } from '~/schemas/pages/misc'
import { groupedKanbanPosts, pagedPosts, post as postQuery } from '~/schemas/pages/post'
import type {
  TCommunityInfo,
  TDoc,
  TDocPublicTree,
  TLocale,
  TPagedArticlesParams,
  TPagedChangelogs,
  TPagedComments,
  TPagedPosts,
  TPost,
  TTagGroup,
  TTagStats,
  TThemePresetOption,
  TThread,
} from '~/spec'
import { parseDashboard, parseWallpaper } from '~/utils/ssr'

const getCommunity = async (community: string): Promise<TCommunityInfo> => {
  'use cache'
  cacheLife('days')
  cacheTag(CACHE_TAG.communityCache(community))

  const { data, errors } = await publicQuery(communityQuery, {
    slug: community,
    userHasLogin: false,
  })

  // console.log('## data: ', data.community.dashboard.enable)

  if (errors) {
    // console.log('## error in fetching', community)
    console.log('## error details 1', errors)
    return {
      community: { slug: '' },
      dashboard: parseDashboard(null),
      wallpaper: parseWallpaper(null),
    }
  }

  return {
    community: data.community as unknown as TCommunityInfo['community'],
    dashboard: parseDashboard(data.community as unknown as TCommunityInfo['community']),
    wallpaper: parseWallpaper(data.community as unknown as TCommunityInfo['community']),
  }
}

/** Returns community info for the frontend shared workflow. */
export const getCommunityInfo = async (community$: string): Promise<TCommunityInfo> => {
  const communityInfo = await getCommunity(community$)

  const { community, dashboard, wallpaper } = communityInfo
  // console.log('## pagedArticles got in server: ', pagedArticles)

  const initState = {
    community,
    wallpaper,
    dashboard,
  }

  // console.log('## initState parseDashboard --> : ', initState.dashboard.original.headerLinks)

  return initState
}

/** Returns locale data for the frontend shared workflow. */
export const getLocaleData = async (
  locale: TLocale = LOCALE.EN,
  namespaces: readonly TI18nNamespace[] = ['base'],
): Promise<Awaited<ReturnType<typeof loadLocaleFile>>> => {
  'use cache'
  cacheLife('days')

  return loadLocaleFile(locale, namespaces)
}

const fetchThemePresets = async (): Promise<TThemePresetOption[]> => {
  'use cache'
  cacheLife('days')

  const { data, errors } = await publicQuery(themePresets, {})

  if (errors || !data?.themePresets) {
    console.log('## error details theme presets', errors)
    return []
  }

  return data.themePresets.map((preset) => ({
    value: preset.value as TThemePresetOption['value'],
    tokens: preset.tokens as TThemePresetOption['tokens'],
  }))
}

/** Returns theme presets for the frontend shared workflow. */
export const getThemePresets = async (): Promise<TThemePresetOption[]> => {
  return fetchThemePresets()
}

const fetchPagedPosts = async (filter: TPagedArticlesParams): Promise<TPagedPosts | null> => {
  type PagedPostsFilter = VariablesOf<typeof pagedPosts>['filter']

  const graphqlFilter: PagedPostsFilter = {
    ...filter,
    cat: filter.cat as PagedPostsFilter['cat'],
    status: filter.status as PagedPostsFilter['status'],
    order: filter.order as PagedPostsFilter['order'],
    when: filter.when as PagedPostsFilter['when'],
    sort: filter.sort as PagedPostsFilter['sort'],
  }
  const { data, errors } = await publicQuery(pagedPosts, {
    filter: graphqlFilter,
    userHasLogin: false,
  })

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data.pagedPosts as unknown as TPagedPosts
}

const getCachedPagedPosts = async (community: string): Promise<TPagedPosts | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articlesCache(community, THREAD.POST))

  return fetchPagedPosts({ community, page: 1 })
}

const isDefaultPagedPostsFilter = (filter: TPagedArticlesParams) => {
  return (
    (filter.page || 1) === 1 &&
    !filter.communityTag &&
    !filter.cat &&
    !filter.status &&
    !filter.order
  )
}

/** Returns paged posts for the frontend shared workflow. */
export const getPagedPosts = async (filter: TPagedArticlesParams): Promise<TPagedPosts | null> => {
  if (!filter.community) {
    return null
  }

  if (isDefaultPagedPostsFilter(filter)) {
    return getCachedPagedPosts(filter.community)
  }

  return fetchPagedPosts(filter)
}

/** Returns paged changelogs for the frontend shared workflow. */
export const getPagedChangelogs = async (community: string): Promise<TPagedChangelogs | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articlesCache(community, THREAD.CHANGELOG))

  const { data, errors } = await publicQuery(pagedChangelogs, {
    filter: { community, page: 1 },
    userHasLogin: false,
  })

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data.pagedChangelogs as unknown as TPagedChangelogs
}

type TGroupedKanbanPosts = {
  backlog: TPagedPosts
  todo: TPagedPosts
  wip: TPagedPosts
  done: TPagedPosts
  rejected: TPagedPosts
}

/** Returns grouped kanban posts for the frontend shared workflow. */
export const getGroupedKanbanPosts = async (
  community: string,
): Promise<TGroupedKanbanPosts | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articlesCache(community, THREAD.KANBAN))

  const { data, errors } = await publicQuery(groupedKanbanPosts, { community })

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data.groupedKanbanPosts as unknown as TGroupedKanbanPosts
}

/** Returns tag groups for the frontend shared workflow. */
export const getTagGroups = async (
  community: string,
  thread: TThread,
): Promise<TTagGroup[] | []> => {
  'use cache'
  //
  cacheLife('days')
  cacheTag(CACHE_TAG.tagsCache(community, thread))

  const gqlThread = TAG_THREADS.includes(thread as (typeof TAG_THREADS)[number]) ? thread : null
  if (!gqlThread) return []

  const { data, errors } = await publicQuery(communityTagGroups, {
    community,
    thread: gqlThread,
  })
  if (errors) {
    // console.log('## error in fetching', community)
    console.log('## error details', errors)
    return []
  }

  return (data.communityTagGroups || []) as unknown as TTagGroup[]
}

/** Returns tag stats for the frontend shared workflow. */
export const getTagStats = async (
  community: string,
  thread: TThread,
  slug?: string | null,
): Promise<TTagStats | null> => {
  if (!slug) return null

  const gqlThread = TAG_THREADS.includes(thread as (typeof TAG_THREADS)[number]) ? thread : null
  if (!gqlThread) return null

  const { data, errors } = await publicQuery(communityTagStats, {
    community,
    thread: gqlThread,
    slug,
  })
  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data.communityTagStats ? { ...data.communityTagStats, slug } : null
}

/** Returns post for the frontend shared workflow. */
export const getPost = async (
  community: string,
  id: string,
  thread: TThread = THREAD.POST,
): Promise<TPost | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articleCache(community, thread, id))
  const { data, errors } = await publicQuery(postQuery, {
    article: {
      innerId: id,
      community,
      thread,
    },
    userHasLogin: false,
  })

  if (errors) {
    // console.log('## error in fetching', community)
    console.log('## error details', errors)
    return null
  }

  return data.post as unknown as TPost
}

/** Returns changelog for the frontend shared workflow. */
export const getChangelog = async (community: string, id: string): Promise<TPost | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articleCache(community, THREAD.CHANGELOG, id))
  const { data, errors } = await publicQuery(changelogQuery, {
    article: {
      innerId: id,
      community,
      thread: THREAD.CHANGELOG,
    },
    userHasLogin: false,
  })

  if (errors) {
    // console.log('## error in fetching', community)
    console.log('## error details', errors)
    return null
  }

  return data.changelog as unknown as TPost
}

/** Returns doc for the frontend shared workflow. */
export const getDoc = async (community: string, id: string): Promise<TDoc | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articleCache(community, THREAD.DOC, id))

  const { data, errors } = await publicQuery(docQuery, {
    article: {
      innerId: id,
      community,
      thread: THREAD.DOC,
    },
    userHasLogin: false,
  })

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data.doc as unknown as TDoc
}

/** Returns doc public tree for the frontend shared workflow. */
export const getDocPublicTree = async (community: string): Promise<TDocPublicTree | null> => {
  'use cache'
  cacheLife('minutes')

  const { data, errors } = await publicQuery(docPublicTree, {
    community,
  })

  if (errors || !data?.docPublicTree) {
    console.log('## error details doc public tree', errors)
    return null
  }

  return data.docPublicTree as unknown as TDocPublicTree
}

/** Returns paged comments for the frontend shared workflow. */
export const getPagedComments = async (
  community: string,
  id: string,
  page = 1,
  thread: TThread = THREAD.POST,
): Promise<TPagedComments | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.commentsCache(community, thread, id))

  const { data, errors } = await publicQuery(pagedComments, {
    article: {
      innerId: id,
      community,
      thread,
    },
    mode: 'REPLIES',
    filter: { page, size: 30 },
  })

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return stripPagedCommentViewerState(data.pagedComments as unknown as TPagedComments)
}
