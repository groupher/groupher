import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAG } from '~/const/cache'
import { LOCALE } from '~/const/i18n'
import { THREAD } from '~/const/thread'
import { loadLocaleFile } from '~/i18n'
import { P } from '~/schemas'
import type { TCommunityInfo, TPagedPosts, TTag, TThread } from '~/spec'
import { gqFetch } from '~/utils/api'
import { parseDashboard, parseWallpaper } from '~/utils/ssr'

export const getCommunity = async (
  community: string,
  pathname: string,
): Promise<TCommunityInfo> => {
  'use cache'
  cacheLife('days')
  cacheTag(CACHE_TAG.communityCache(community))

  const response = await gqFetch(P.community, { slug: community, userHasLogin: false })

  const { data, errors } = await response.json()

  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details', errors)
    return {
      community: { slug: '' },
    }
  }

  return {
    community: data.community,
    dashboard: parseDashboard(data.community, pathname),
    wallpaper: parseWallpaper(data.community),
  }
}

export const getCommunityInfo = async (community$: string): Promise<TCommunityInfo> => {
  const communityInfo = await getCommunity(community$, '/home/post')

  const { community, dashboard, wallpaper } = communityInfo
  // console.log('## pagedArticles got in server: ', pagedArticles)

  const initState = {
    community,
    wallpaper,
    dashboard,
  }

  return initState
}

export const getLocaleData = async (): Promise<any> => {
  'use cache'
  cacheLife('days')

  return loadLocaleFile(LOCALE.EN)
}

export const getPagedPosts = async (community: string): Promise<TPagedPosts | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articlesCache(community, THREAD.POST))

  const response = await gqFetch(P.pagedPosts, {
    filter: { community, page: 1 },
    userHasLogin: false,
  })

  const { data, errors } = await response.json()

  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details', errors)
    return null
  }

  return data.pagedPosts
}

export const getTags = async (community: string, thread: TThread): Promise<TTag[] | []> => {
  'use cache'
  //
  cacheLife('days')
  cacheTag(CACHE_TAG.tagsCache(community, thread))

  const response = await gqFetch(P.pagedArticleTags, { community, thread })

  const { data, errors } = await response.json()
  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details', errors)
    return []
  }

  console.log('## data.pagedArticleTags.entries: ', data.pagedArticleTags.entries)

  return data.pagedArticleTags.entries
}
