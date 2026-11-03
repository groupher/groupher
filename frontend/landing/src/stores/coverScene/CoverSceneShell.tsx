import { type ReactNode, useMemo, useState } from 'react'

import { LANDING_INIT_DATA } from '~/const/name'
import { serializeCommunityThemePresetCss } from '~/lib/theme'
import StaticShellProvider from '~/stores/StaticShellProvider'
import type { TInit as TThemeInit } from '~/stores/theme/spec'

import { COVER_SCENES } from '../../const/coverScenes'
import { BASE_THEME_PRESET } from '../../const/scenes/shared'
import { serializeLandingAppearanceCss } from './appearanceCss'
import { CoverSceneContext } from './context'

type TProps = {
  children: ReactNode
  localeData: string
  theme: TThemeInit
}

export default function CoverSceneShell({ children, localeData, theme }: TProps) {
  const [sceneId, setSceneId] = useState('feedback')
  const scene = COVER_SCENES.find((item) => item.id === sceneId) ?? COVER_SCENES[4]
  const context = useMemo(() => ({ scene, selectScene: setSceneId }), [scene])
  const sceneWallpaper = {
    version: 1,
    lightSource: scene.wallpaper.light.source,
    darkSource: scene.wallpaper.dark.source,
    light: scene.wallpaper.light.assets,
    dark: scene.wallpaper.dark.assets,
  }
  const wallpaper = {
    ...LANDING_INIT_DATA.wallpaper,
    wallpaper: sceneWallpaper,
    light: {
      ...LANDING_INIT_DATA.wallpaper.light,
      source: scene.wallpaper.light.source,
      type: scene.wallpaper.light.type,
      pattern: scene.wallpaper.light.pattern ?? LANDING_INIT_DATA.wallpaper.light.pattern,
    },
    dark: {
      ...LANDING_INIT_DATA.wallpaper.dark,
      source: scene.wallpaper.dark.source,
      type: scene.wallpaper.dark.type,
      pattern: scene.wallpaper.dark.pattern ?? LANDING_INIT_DATA.wallpaper.dark.pattern,
    },
  }

  const sceneCss =
    scene.themePreset === BASE_THEME_PRESET
      ? ''
      : serializeCommunityThemePresetCss(scene.themePreset)
  const appearanceCss = serializeLandingAppearanceCss(scene)

  return (
    <CoverSceneContext value={context}>
      <style>{sceneCss + '\n' + appearanceCss}</style>
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
