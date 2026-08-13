import type { ResultOf, TypedDocumentNode, VariablesOf } from '@graphql-typed-document-node/core'
import type { Metadata } from 'next'
import { cacheLife, cacheTag } from 'next/cache'

import { CACHE_TAG } from '~/const/cache'
import { THREAD } from '~/const/thread'
import { extractRootResponseKey } from '~/graphql/document'
import { gqFetchTyped } from '~/graphql/server'
import { pagedChangelogs } from '~/schemas/pages/changelog'
import { pagedPosts } from '~/schemas/pages/post'
import type { TPagedArticles, TPagedArticlesParams, TParseDashboard, TThread } from '~/spec'
export { parseDashboard, parseWallpaper } from './parse'

type TTwitterCard = 'summary' | 'summary_large_image' | 'player' | 'app'

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
//     state: searchParams.get(URL_PARAM.STATUS),
//   }) as TPagedArticlesParams

//   return mergeRight(ARTICLES_FILTER, filter)
// }

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
      return {
        schema: pagedChangelogs,
        variables: {
          filter: filter as VariablesOf<typeof pagedChangelogs>['filter'],
          userHasLogin: false,
        },
      }
    }
    // groupedKanbanPosts remains outside this article-list selector.

    default: {
      return {
        schema: pagedPosts,
        variables: {
          filter: filter as VariablesOf<typeof pagedPosts>['filter'],
          userHasLogin: false,
        },
      }
    }
  }
}

const isDefaultPagedArticlesFilter = (filter: TPagedArticlesParams) => {
  return (
    (filter.page || 1) === 1 &&
    !filter.size &&
    !filter.communityTag &&
    !filter.cat &&
    !filter.status &&
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
  type PagedVariables = VariablesOf<typeof pagedPosts> | VariablesOf<typeof pagedChangelogs>
  type PagedResult = ResultOf<typeof pagedPosts> | ResultOf<typeof pagedChangelogs>

  const { data, errors } = await gqFetchTyped(
    schema as TypedDocumentNode<PagedResult, PagedVariables>,
    variables as PagedVariables,
  )

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  const responseKey = extractRootResponseKey(schema)
  return responseKey
    ? ((data as Record<string, TPagedArticles | null> | undefined)?.[responseKey] ?? null)
    : null
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

/** Returns paged articles for the frontend shared workflow. */
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

/** Returns metadata for the frontend shared workflow. */
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
