import type { ResultOf } from '@graphql-typed-document-node/core'
import { createServerFn } from '@tanstack/react-start'

import { parseDashboard, parseWallpaper } from '~/lib/ssr/parse'
import { serializeCommunityThemePresetCss } from '~/lib/themePreset'
import { community as communityQuery } from '~/schemas/pages/community'
import type { TCommunity, TParseDashboard } from '~/spec'
import { isDsbDemoMode } from '~/utils/dsb-demo'

import { fetchGraphQL, getAuthToken, setPrivateCacheHeader } from './graphql'

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
  community: TCommunity
  dashboard: TParseDashboard
  wallpaper: ReturnType<typeof parseWallpaper>
  themeCssText: string
  demoMode: boolean
}

export const loadCommunity = createServerFn({ method: 'GET', strict: false })
  .validator(parseInput)
  .handler(async ({ data }): Promise<TCommunityShell> => {
    const token = getAuthToken()
    const userHasLogin = Boolean(token)
    const isDemoMode = isDsbDemoMode(data.community, data.mode)

    setPrivateCacheHeader()

    const communityResult = await fetchGraphQL<ResultOf<typeof communityQuery>>(
      communityQuery,
      { incViews: false, slug: data.community, userHasLogin },
      token,
    )

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
      community,
      dashboard,
      wallpaper: parseWallpaper(community),
      themeCssText: serializeCommunityThemePresetCss(dashboard.themeTokens),
      demoMode: isDemoMode,
    }
  })
