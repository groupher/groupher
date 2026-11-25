import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { type ReactNode, useEffect, useMemo } from 'react'

import { parseWallpaper } from '~/lib/ssr/parse'
import { dsbKeys, Q } from '~/query'
import type { TCommunity, TDsb, TParsedWallpaper } from '~/spec'
import StaticWallpaperProvider from '~/stores/staticWallpaper/provider'
import WallpaperStoreProvider from '~/stores/wallpaper/provider'
import WallpaperRuntimeProvider from '~/stores/wallpaperRuntime/provider'

type TProps = {
  children: ReactNode
  community: string
  dashboard: TDsb
  demoMode: boolean
  wallpaper: TParsedWallpaper
}

/** Owns route-specific Wallpaper reads and keeps editor projections at their boundary. */
export default function WallpaperEditorBoundary({
  children,
  community,
  dashboard,
  demoMode,
  wallpaper,
}: TProps) {
  const queryClient = useQueryClient()
  const runtimeMode = useRouterState({
    select: (state) =>
      state.matches.some((match) => match.routeId === '/$community/appearance/wallpaper')
        ? 'editor'
        : 'static',
  })
  const isEditorRoute = runtimeMode === 'editor'
  const { data: editorData } = useQuery({
    ...Q.wallpaperEditor.slug(community),
    enabled: isEditorRoute && !demoMode,
  })
  const editorWallpaper = useMemo(() => {
    if (!isEditorRoute || demoMode || !editorData?.community) return null
    return parseWallpaper(editorData.community as unknown as TCommunity)
  }, [demoMode, editorData?.community, isEditorRoute])
  const editorContentShadow = useMemo(() => {
    if (!isEditorRoute || demoMode || !editorData?.community) return dashboard.contentShadow
    return editorData.community.dashboard?.contentShadow ?? dashboard.contentShadow
  }, [dashboard.contentShadow, demoMode, editorData?.community, isEditorRoute])

  useEffect(() => {
    if (!isEditorRoute || demoMode || editorContentShadow === undefined) return

    queryClient.setQueryData<TDsb>(dsbKeys.slug(community), (current) =>
      current ? { ...current, contentShadow: editorContentShadow } : current,
    )
  }, [community, demoMode, editorContentShadow, isEditorRoute, queryClient])

  const wallpaperInit = useMemo(
    () =>
      editorWallpaper
        ? {
            ...wallpaper,
            light: editorWallpaper.light,
            dark: editorWallpaper.dark,
            initWallpaper: editorWallpaper.initWallpaper,
          }
        : wallpaper,
    [editorWallpaper, wallpaper],
  )
  const runtimeContent = (
    <StaticWallpaperProvider initData={wallpaper?.wallpaper}>
      <WallpaperRuntimeProvider mode={runtimeMode}>{children}</WallpaperRuntimeProvider>
    </StaticWallpaperProvider>
  )

  if (!isEditorRoute) return runtimeContent

  return (
    <WallpaperStoreProvider
      initData={wallpaperInit}
      demoCommunity={demoMode ? community : undefined}
    >
      {runtimeContent}
    </WallpaperStoreProvider>
  )
}
