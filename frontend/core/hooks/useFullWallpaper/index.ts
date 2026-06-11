import { GRADIENT_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import useTheme from '~/hooks/useTheme'
import {
  composeBgGradientAssetWallpapers,
  composeBgGradientPaletteWallpapers,
  composeBgPatternAssetWallpapers,
} from '~/lib/bg'
import type { TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TGradientPalette, TWallpaper, TWallpaperData } from '~/spec'
import { pickWallpaperThemeState, toWallpaperThemePatch } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

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
  const store = useWallpaperDomain()
  const { isDarkTheme } = useTheme()

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
    const themedState = pickWallpaperThemeState(store, isDarkTheme)
    const { gradient, pattern, contentShadow, effect, texture, source, type } = themedState

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

  const changeWallpaper = (source: string): void =>
    store.commit(toWallpaperThemePatch({ source }, isDarkTheme))

  const changePatternWallpaper = (source: string): void =>
    store.commit(toWallpaperThemePatch({ source, type: WALLPAPER_TYPE.PATTERN }, isDarkTheme))

  return {
    source: pickWallpaperThemeState(store, isDarkTheme).source,
    changeWallpaper,
    changePatternWallpaper,
    getGradientPalettes,
    getGradientWallpapers,
    getPatternWallpapers,
    getWallpaper,
  }
}
