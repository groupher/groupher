import { type ReactNode, useMemo, useState } from 'react'

import { LANDING_INIT_DATA } from '~/const/name'
import type { TPublishedWallpaper } from '~/spec'
import StaticShellProvider from '~/stores/StaticShellProvider'
import type { TInit as TThemeInit } from '~/stores/theme/spec'

import { COVER_SCENES } from '../../const/coverScenes'
import { CoverSceneContext } from './context'

type TProps = {
  children: ReactNode
  localeData: string
  theme: TThemeInit
}

const publishedSceneWallpaper = (source: string, url: string): TPublishedWallpaper => {
  const image = { url, width: 1920, height: 1080 }
  const profiles = { wide: image, desktop: image, tablet: image, phone: image }

  return {
    version: 1,
    lightSource: source,
    darkSource: source,
    light: profiles,
    dark: profiles,
  }
}

export default function CoverSceneShell({ children, localeData, theme }: TProps) {
  const [sceneId, setSceneId] = useState('feedback')
  const scene = COVER_SCENES.find((item) => item.id === sceneId) ?? COVER_SCENES[0]
  const context = useMemo(() => ({ scene, selectScene: setSceneId }), [scene])
  const sceneWallpaper =
    scene.id === 'feedback'
      ? LANDING_INIT_DATA.wallpaper.wallpaper
      : publishedSceneWallpaper(scene.wallpaperSource, scene.wallpaperImage)
  const wallpaper = {
    ...LANDING_INIT_DATA.wallpaper,
    wallpaper: sceneWallpaper,
    light: {
      ...LANDING_INIT_DATA.wallpaper.light,
      source: scene.wallpaperSource,
      type: scene.wallpaperType,
    },
    dark: {
      ...LANDING_INIT_DATA.wallpaper.dark,
      source: scene.wallpaperSource,
      type: scene.wallpaperType,
    },
  }

  return (
    <CoverSceneContext value={context}>
      <StaticShellProvider
        community={LANDING_INIT_DATA.community}
        footerLinks={LANDING_INIT_DATA.footerLinks}
        wallpaper={wallpaper}
        localeData={localeData}
        theme={theme}
      >
        {children}
      </StaticShellProvider>
    </CoverSceneContext>
  )
}
