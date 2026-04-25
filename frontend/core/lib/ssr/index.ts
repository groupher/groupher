import type { Metadata } from 'next'
import { cacheLife, cacheTag } from 'next/cache'
import { includes, reject } from 'ramda'

import { CACHE_TAG } from '~/const/cache'
import { PAGE_BG_DEFAULT } from '~/const/colors'
import { INIT_KANBAN_BOARDS, normalizeKanbanBoards } from '~/const/dashboard'
import { BUILTIN_ALIAS } from '~/const/name'
import THEME from '~/const/theme'
import { TAG_THREADS, THREAD } from '~/const/thread'
import { removeEmptyValuesFromObject } from '~/helper'
import { P } from '~/schemas'
import type {
  TCommunity,
  TNameAlias,
  TPagedArticles,
  TPagedArticlesParams,
  TPagedTags,
  TParseDashboard,
  TParsedWallpaper,
  TThread,
} from '~/spec'
import { FIELDS } from '~/stores/dashboard/constant'
import { gqFetch } from '~/utils/api'
import { extractQueryName } from '~/utils/graphql'

import type { TGQSSRResult } from './spec'

type TTwitterCard = NonNullable<Metadata['twitter']>['card']

export const commonRes = (result): TGQSSRResult => {
  return {
    fetching: result.fetching,
    error: result.error,
    stale: result.stale,
  }
}

/**
 * common url filter logic for all paged articles queries
 */
// export const usePagedArticlesParams = (searchParams: URLSearchParams): TPagedArticlesParams => {
//   const community = 'home'

//   const filter = removeEmptyValuesFromObject({
//     community,
//     page: Number(searchParams.get(URL_PARAM.PAGE)) || 1,
//     size: 20,

//     communityTag: searchParams.get(URL_PARAM.TAG),
//     cat: searchParams.get(URL_PARAM.CAT),
//     state: searchParams.get(URL_PARAM.STATE),
//   }) as TPagedArticlesParams

//   return mergeRight(ARTICLES_FILTER, filter)
// }

export const parseWallpaper = (community: TCommunity): TParsedWallpaper => {
  // NOTE: if the backend is not ready, return default config
  // @ts-expect-error
  if (!community) return {}

  const { dashboard } = community
  const { wallpaper } = dashboard

  return {
    ...wallpaper,
    initWallpaper: {
      ...wallpaper,
    },
  }
}

const parseDashboardAlias = (nameAlias: TNameAlias[]): TNameAlias[] => {
  const changedAliasKeys = nameAlias.map((item) => item.original)
  const unChangedAlias = reject(
    (item: TNameAlias) => includes(item.original, changedAliasKeys),
    BUILTIN_ALIAS,
  )

  return reject((item: TNameAlias) => item.slug === '', [...nameAlias, ...unChangedAlias])
}

export const parseDashboard = (community: TCommunity): TParseDashboard => {
  if (!community) {
    const defaultFields = { ...FIELDS }
    return {
      ...defaultFields,
      original: defaultFields,
    }
  }

  const { dashboard, moderators } = community

  if (!dashboard || Object.keys(dashboard).length === 0) {
    const defaultFields = { ...FIELDS }
    return {
      ...defaultFields,
      original: defaultFields,
    }
  }

  const {
    enable,
    nameAlias,
    socialLinks,
    faqs,
    seo,
    layout,
    rss,
    baseInfo,
    headerLinks,
    footerLinks,
    mediaReports,
  } = dashboard

  const fieldsObj = removeEmptyValuesFromObject({
    enable,
    nameAlias: parseDashboardAlias([...nameAlias]),
    socialLinks,
    faqSections: faqs,
    ...baseInfo,
    ...seo,
    ...layout,
    subPrimaryColor: layout?.subPrimaryColor || layout?.primaryColor,
    ...rss,
    headerLinks,
    footerLinks,
    moderators,
    mediaReports,
    pageBg: layout?.pageBg || PAGE_BG_DEFAULT[THEME.LIGHT],
    pageBgDark: layout?.pageBgDark || PAGE_BG_DEFAULT[THEME.DARK],
  }) as Partial<TParseDashboard>

  if (layout?.kanbanBoards?.length) {
    fieldsObj.kanbanBoards = normalizeKanbanBoards(layout.kanbanBoards)
  } else if (!fieldsObj.kanbanBoards?.length) {
    fieldsObj.kanbanBoards = INIT_KANBAN_BOARDS
  }

  // If fieldsObj is empty, return default config
  if (Object.keys(fieldsObj).length === 0) {
    const defaultFields = { ...FIELDS }
    return {
      ...defaultFields,
      original: defaultFields,
    }
  }

  // Merge with default fields to ensure all required properties exist
  const mergedFields = { ...FIELDS, ...fieldsObj }

  return {
    ...mergedFields,
    original: mergedFields,
  }
}

// used in server/api

const hasArticles = (thread: TThread) => {
  return [THREAD.POST, THREAD.CHANGELOG].includes(
    thread as typeof THREAD.POST | typeof THREAD.CHANGELOG,
  )
}

const getPagedQuery = (
  community: string,
  thread: TThread,
  filter: TPagedArticlesParams = { community, page: 1 },
) => {
  switch (thread) {
    case THREAD.CHANGELOG: {
      return { schema: P.pagedChangelogs, variables: { filter, userHasLogin: false } }
    }
    // P.groupedKanbanPosts

    default: {
      return { schema: P.pagedPosts, variables: { filter, userHasLogin: false } }
    }
  }
}

const isDefaultPagedArticlesFilter = (filter: TPagedArticlesParams) => {
  return (
    (filter.page || 1) === 1 &&
    !filter.size &&
    !filter.communityTag &&
    !filter.cat &&
    !filter.state &&
    !filter.order
  )
}

const fetchPagedArticles = async (
  community: string,
  thread: TThread,
  filter: TPagedArticlesParams,
): Promise<TPagedArticles | null> => {
  if (!hasArticles(thread)) return null

  const { schema, variables } = getPagedQuery(community, thread, filter)
  const response = await gqFetch(schema, variables)

  const { data, errors } = await response.json()

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data[extractQueryName(schema)]
}

const getCachedPagedArticles = async (
  community: string,
  thread: TThread,
): Promise<TPagedArticles | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articlesCache(community, thread))

  return fetchPagedArticles(community, thread, { community, page: 1 })
}

export const getPagedArticles = async (
  community: string,
  thread: TThread,
  filter: TPagedArticlesParams = { community, page: 1 },
): Promise<TPagedArticles | null> => {
  if (isDefaultPagedArticlesFilter(filter)) {
    return getCachedPagedArticles(community, thread)
  }

  return fetchPagedArticles(community, thread, filter)
}

export const getPagedTags = async (
  community: string,
  thread: TThread,
): Promise<TPagedTags | null> => {
  'use cache'
  cacheLife('hours')
  cacheTag(CACHE_TAG.tagsCache(community, thread))

  const gqlThread = TAG_THREADS.includes(thread as (typeof TAG_THREADS)[number]) ? thread : null
  if (!gqlThread) return null

  const response = await gqFetch(P.pagedCommunityTags, { filter: { community, thread: gqlThread } })

  const { data, errors } = await response.json()

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data[extractQueryName(P.pagedCommunityTags)]
}

export const getMetadata = (dashboard: TParseDashboard): Metadata => {
  const {
    seoEnable,
    ogTitle,
    ogSiteName,
    ogUrl,
    ogDescription,
    ogImage,
    // twitter
    twCard,
    twSite,
    twTitle,
    twDescription,
    twImage,
  } = dashboard

  return {
    title: ogTitle,
    description: ogDescription,
    robots: seoEnable ? undefined : 'noindex',
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      siteName: ogSiteName,
      url: ogUrl,
      type: 'website',
      images: ogImage ? [ogImage] : [],
    },
    twitter: {
      card: (twCard as TTwitterCard) || 'summary',
      site: twSite,
      title: twTitle || ogTitle,
      description: twDescription || ogDescription,
      images: twImage ? [twImage] : ogImage ? [ogImage] : [],
    },
  }
}
