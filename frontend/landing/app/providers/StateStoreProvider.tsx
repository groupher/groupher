'use client'

import type { ReactNode } from 'react'

import { HOME_COMMUNITY } from '~/const/name'

import { StoreContext, useStore } from '../stores'

import {
  useI18n,
  useThemeFromURL,
  useCommunity,
  useThreadParam,
  useDashboard,
  useWallpaper,
  useTags,
  useMetric,
  usePost,
  useChangelog,
  usePagedPosts,
  usePagedChangelogs,
  useGroupedKanbanPosts,
  useFilterSearchParams,
} from '../queries'

export default ({ children }: { children: ReactNode }) => {
  const metric = useMetric()
  const { locale, localeData } = useI18n()

  const theme = useThemeFromURL()
  const { pagedPosts } = usePagedPosts()
  const { pagedChangelogs } = usePagedChangelogs()
  const { groupedKanbanPosts } = useGroupedKanbanPosts()
  const filterSearchParams = useFilterSearchParams()

  const { post } = usePost()
  const { changelog } = useChangelog()
  const { community } = useCommunity()
  const activeThread = useThreadParam()
  const { tags } = useTags()

  const dashboard = useDashboard(community)
  const wallpaper = useWallpaper(community)

  const rootStore = useStore({
    locale,
    localeData,
    theme,
    articles: {
      pagedPosts,
      pagedChangelogs,
      ...groupedKanbanPosts,
      ...filterSearchParams,
    },
    viewing: {
      metric,
      post,
      changelog,
      community: community || HOME_COMMUNITY,
      activeThread,
      tags,
    },
    wallpaper,
    dashboard,
  })

  return <StoreContext.Provider value={rootStore}>{children}</StoreContext.Provider>
}
