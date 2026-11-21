import type { ResultOf } from '@graphql-typed-document-node/core'
import { createServerFn } from '@tanstack/react-start'

import { parseDashboard, parseWallpaper } from '~/lib/ssr/parse'
import { serializeCommunityThemePresetCss } from '~/lib/theme'
import { community as communityQuery } from '~/schemas/pages/community'
import { sessionState as sessionStateQuery } from '~/schemas/pages/user'
import type { TCommunity, TDsb, TUser } from '~/spec'
import type { TInit as TAccountInit } from '~/stores/account/spec'
import wallpaperDocument from '~/unit/DsbThread/Appearance/Wallpaper/schema'

import { fetchGraphQL, getAuthToken, hasSignedInHint, setPrivateCacheHeader } from './graphql'

type TLoadCommunityInput = {
  community: string
  lang?: string
  mode?: string
}

const parseInput = (data: TLoadCommunityInput): TLoadCommunityInput => {
  if (!data.community) throw new Error('A community is required to load Dash.')

  return data
}

const makeOverview = (community: TCommunity) => ({
  views: community.views || 0,
  subscribersCount: community.subscribersCount || 0,
  postsCount: community.meta?.postsCount || 0,
  changelogsCount: community.meta?.changelogsCount || 0,
  docsCount: community.meta?.docsCount || 0,
})

export type TCommunityShell = {
  account: TAccountInit
  community: TCommunity
  dashboard: TDsb
  wallpaper: ReturnType<typeof parseWallpaper>
  themeCssText: string
  demoMode: boolean
}

export type TWallpaperEditorData = ResultOf<typeof wallpaperDocument.wallpaperEditor>

export const loadWallpaperEditor = createServerFn({ method: 'GET', strict: false })
  .validator(parseInput)
  .handler(async ({ data }): Promise<TWallpaperEditorData> => {
    const token = getAuthToken()
    setPrivateCacheHeader()

    const result = await fetchGraphQL<TWallpaperEditorData>(
      wallpaperDocument.wallpaperEditor,
      { community: data.community },
      token,
    )

    if (!result.data?.community) throw new Error('Community was not found.')
    return result.data
  })

export const loadCommunity = createServerFn({ method: 'GET', strict: false })
  .validator(parseInput)
  .handler(async ({ data }): Promise<TCommunityShell> => {
    const token = getAuthToken()
    const userHasLogin = Boolean(token)
    const isDemoMode = data.community === 'home' && data.mode === 'demo'
    const signedInHint = hasSignedInHint()

    setPrivateCacheHeader()

    const communityPromise = fetchGraphQL<ResultOf<typeof communityQuery>>(
      communityQuery,
      { incViews: false, slug: data.community, userHasLogin },
      token,
    )
    const accountPromise = token
      ? loadAccount(token)
      : Promise.resolve<TAccountInit>({ loading: signedInHint, user: null })
    const [communityResult, account] = await Promise.all([communityPromise, accountPromise])

    const community = communityResult.data?.community as unknown as TCommunity | null | undefined
    if (!community) {
      const detail = communityResult.errors?.[0]?.message || 'Community was not found.'
      throw new Error(detail)
    }

    const dashboard = {
      ...parseDashboard(community),
      overview: makeOverview(community),
    }

    return {
      account,
      community,
      dashboard,
      wallpaper: parseWallpaper(community),
      themeCssText: serializeCommunityThemePresetCss(dashboard.themeTokens),
      demoMode: isDemoMode,
    }
  })

const loadAccount = async (token: string): Promise<TAccountInit> => {
  const result = await fetchGraphQL<ResultOf<typeof sessionStateQuery>>(
    sessionStateQuery,
    {},
    token,
  )
  const session = result.data?.sessionState
  const sessionUser = session?.isValid ? session.user : null
  const user: TUser | null = sessionUser
    ? (() => {
        const {
          subscribedCommunitiesCount: _subscribedCommunitiesCount,
          social,
          ...publicUser
        } = sessionUser

        return {
          ...publicUser,
          login: sessionUser.login ?? undefined,
          nickname: sessionUser.nickname ?? undefined,
          avatar: sessionUser.avatar ?? undefined,
          bio: sessionUser.bio ?? undefined,
          shortbio: sessionUser.shortbio ?? undefined,
          geoCity: sessionUser.geoCity ?? undefined,
          location: sessionUser.location ?? undefined,
          social: social
            ? {
                github: social.github ?? undefined,
                twitter: social.twitter ?? undefined,
                company: social.company ?? undefined,
                blog: social.blog ?? undefined,
              }
            : undefined,
          passport: sessionUser.passport as TUser['passport'],
        }
      })()
    : null

  return {
    loading: false,
    user,
  }
}
