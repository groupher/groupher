import { use } from 'react'
import { useSnapshot } from 'valtio'

import { GRADIENT_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import useTheme from '~/hooks/useTheme'
import {
  composeBgGradientAssetWallpapers,
  composeBgGradientPaletteWallpapers,
  composeBgPatternAssetWallpapers,
} from '~/lib/bg'
import type { TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TGradientPalette, TWallpaper, TWallpaperData } from '~/spec'
import useDsb from '~/stores/dsb/hooks'
import useStaticWallpaper from '~/stores/staticWallpaper/hooks'
import createWallpaperStore from '~/stores/wallpaper'
import { INITIAL_WALLPAPER_THEME_STATE } from '~/stores/wallpaper/constant'
import { StoreContext } from '~/stores/wallpaper/context'
import { pickWallpaperThemeState, toWallpaperThemePatch } from '~/stores/wallpaper/helper'
import type { TStore } from '~/stores/wallpaper/spec'

const EMPTY_WALLPAPER_STORE = createWallpaperStore()

type TRet = {
  source: string
  changeWallpaper: (source: string) => void
  changePatternWallpaper: (source: string) => void
  getWallpaper: () => TWallpaperData
  getGradientWallpapers: () => Record<string, TGradientRecipe>
  getGradientPalettes: () => Record<string, TGradientPalette>
  getPatternWallpapers: () => Record<string, TWallpaper>
}

/**
 * Shared accessors and mutators for the wallpaper panel data model.
 *
 * Exposed to non-UI consumers (for example tabs/selectors) so they share the same
 * catalog/protocol sources as hook-level background rendering.
 *
 * @example
 * const fullWallpaper = useFullWallpaper()
 * const wallpapers = fullWallpaper.getGradientWallpapers()
 */
export default function useFullWallpaper(): TRet {
  const store = use(StoreContext)
  const snapshot = useSnapshot(store ?? EMPTY_WALLPAPER_STORE) as unknown as TStore
  const { isDarkTheme } = useTheme()
  const dashboard = useDsb()
  const staticWallpaper = useStaticWallpaper()
  const editorStore = store

  const getGradientWallpapers = (): Record<string, TGradientRecipe> => {
    return composeBgGradientAssetWallpapers()
  }

  const getGradientPalettes = (): Record<string, TGradientPalette> => {
    return composeBgGradientPaletteWallpapers()
  }

  const getPatternWallpapers = (): Record<string, TWallpaper> => {
    return composeBgPatternAssetWallpapers()
  }

  const getWallpaper = (): TWallpaperData => {
    const themedState = editorStore
      ? pickWallpaperThemeState(snapshot, isDarkTheme)
      : {
          ...INITIAL_WALLPAPER_THEME_STATE,
          source: staticWallpaper?.[isDarkTheme ? 'darkSource' : 'lightSource'] ?? 'amber_mauve',
        }
    const { gradient, pattern, effect, texture, source, type } = themedState
    const contentShadow = dashboard.contentShadow ?? false

    const hasBlur = effect.blurIntensity > 0
    const activeGradient = gradient || GRADIENT_WALLPAPER[source] || GRADIENT_WALLPAPER.amber_mauve

    return {
      source,
      type,
      pattern,
      hasBlur,
      contentShadow,
      effect,
      gradient: activeGradient,
      texture,
      gradientPalettes: getGradientPalettes(),
      gradientWallpapers: getGradientWallpapers(),
      patternWallpapers: getPatternWallpapers(),
    }
  }

  const changeWallpaper = (source: string): void => {
    editorStore?.commit(toWallpaperThemePatch({ source }, isDarkTheme))
  }

  const changePatternWallpaper = (source: string): void =>
    editorStore?.commit(
      toWallpaperThemePatch({ source, type: WALLPAPER_TYPE.PATTERN }, isDarkTheme),
    )

  return {
    source: editorStore
      ? pickWallpaperThemeState(snapshot, isDarkTheme).source
      : (staticWallpaper?.[isDarkTheme ? 'darkSource' : 'lightSource'] ?? 'amber_mauve'),
    changeWallpaper,
    changePatternWallpaper,
    getGradientPalettes,
    getGradientWallpapers,
    getPatternWallpapers,
    getWallpaper,
  }
}
