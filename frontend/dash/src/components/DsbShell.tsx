import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { type ReactNode, useEffect, useMemo } from 'react'

import { GlobalProvider } from '~/app/providers'
import METRIC from '~/const/metric'
import { parseWallpaper } from '~/lib/ssr/parse'
import { Q } from '~/query'
import type { TCommunity } from '~/spec'
import ContentShadowProvider from '~/stores/contentShadow/provider'
import DsbConfigProvider from '~/stores/dsbConfig/provider'
import DsbEditProvider from '~/stores/dsbEdit/provider'
import { DsbEditorUiProvider } from '~/stores/dsbEditorUi'
import { DsbShellUiProvider } from '~/stores/dsbShellUi'
import { MetricProvider } from '~/stores/metric'
import StaticWallpaperProvider from '~/stores/staticWallpaper/provider'
import ThemePresetStoreProvider from '~/stores/ThemePreset/provider'
import WallpaperStoreProvider from '~/stores/wallpaper/provider'
import WallpaperRuntimeProvider from '~/stores/wallpaperRuntime/provider'
import CommunityDigest from '~/unit/CommunityDigest/DsbLayout'
import { SideMenu } from '~/unit/DsbThread'

import { clearAuthRouteRecoveryAttempt } from '../utils/auth-route-recovery'

type TProps = {
  children: ReactNode
  data: {
    community: string
    demoMode: boolean
  }
}

export default function DsbShell({ children, data }: TProps) {
  const { data: dashboard } = useSuspenseQuery(Q.dsb.slug(data.community))
  const { data: wallpaper } = useSuspenseQuery(Q.wallpaper.slug(data.community))
  const wallpaperRuntimeMode = useRouterState({
    select: (state) =>
      state.matches.some((match) => match.routeId === '/$community/appearance/wallpaper')
        ? 'editor'
        : 'static',
  })
  const isEditorRoute = wallpaperRuntimeMode === 'editor'
  const { data: editorData } = useQuery({
    ...Q.wallpaperEditor.slug(data.community),
    enabled: isEditorRoute,
  })
  const editorWallpaper = useMemo(() => {
    if (!isEditorRoute || !editorData?.community) return null
    return parseWallpaper(editorData.community as unknown as TCommunity)
  }, [editorData?.community, isEditorRoute])
  const editorContentShadow = useMemo(() => {
    if (!isEditorRoute || !editorData?.community) return dashboard.contentShadow
    return editorData.community.dashboard?.contentShadow ?? dashboard.contentShadow
  }, [dashboard.contentShadow, editorData?.community, isEditorRoute])
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

  useEffect(() => {
    clearAuthRouteRecoveryAttempt(window.location.href)
  }, [])

  const shellContent = (
    <DsbConfigProvider initData={dashboard}>
      <ThemePresetStoreProvider initData={dashboard}>
        <StaticWallpaperProvider initData={wallpaper?.wallpaper}>
          <WallpaperRuntimeProvider mode={wallpaperRuntimeMode}>
            <GlobalProvider authLoginModal={false}>
              <div
                className='column-center min-h-full w-full justify-start'
                data-demo-mode={data.demoMode}
              >
                <div className='container-dashboard relative w-full transition-all duration-150 ease-out'>
                  <CommunityDigest />

                  <div className='row mt-7 min-h-screen w-full'>
                    <div className='shrink-0 self-stretch overflow-visible transition-all duration-150 ease-out'>
                      <SideMenu />
                    </div>
                    <div className='column min-w-0 grow items-center bg-transparent'>
                      {children}
                    </div>
                  </div>
                </div>
              </div>
            </GlobalProvider>
          </WallpaperRuntimeProvider>
        </StaticWallpaperProvider>
      </ThemePresetStoreProvider>
    </DsbConfigProvider>
  )

  const content = isEditorRoute ? (
    <ContentShadowProvider initData={editorContentShadow}>
      <WallpaperStoreProvider initData={wallpaperInit}>{shellContent}</WallpaperStoreProvider>
    </ContentShadowProvider>
  ) : (
    shellContent
  )

  return (
    <MetricProvider value={METRIC.DASHBOARD}>
      <DsbShellUiProvider>
        <DsbEditorUiProvider>
          {data.demoMode ? (
            content
          ) : (
            <DsbEditProvider initialData={dashboard}>{content}</DsbEditProvider>
          )}
        </DsbEditorUiProvider>
      </DsbShellUiProvider>
    </MetricProvider>
  )
}
