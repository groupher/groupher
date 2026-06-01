import { GRADIENT_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import useTheme from '~/hooks/useTheme'
import type { TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TWallpaper, TWallpaperData } from '~/spec'
import { resolveWallpaperThemeState, toWallpaperThemePatch } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

import { buildGradientCatalogWallpapers, buildPatternCatalogWallpapers } from './helper'

type TRet = {
  source: string
  changeWallpaper: (source: string) => void
  changePatternWallpaper: (source: string) => void
  getWallpaper: () => TWallpaperData
  getGradientWallpapers: () => Record<string, TGradientRecipe>
  getPatternWallpapers: () => Record<string, TWallpaper>
}

export default function useFullWallpaper(): TRet {
  const store = useWallpaperDomain()
  const { isDarkTheme } = useTheme()

  const getGradientWallpapers = (): Record<string, TGradientRecipe> => {
    return buildGradientCatalogWallpapers()
  }

  const getPatternWallpapers = (): Record<string, TWallpaper> => {
    return buildPatternCatalogWallpapers()
  }

  const getWallpaper = (): TWallpaperData => {
    const themedState = resolveWallpaperThemeState(store, isDarkTheme)
    const {
      gradient,
      hasPattern,
      patternId,
      patternIntensity,
      patternTone,
      hasTexture,
      blurIntensity,
      hasShadow,
      brightness,
      saturation,
      texture,
      source,
      type,
      bgSize,
    } = themedState

    const hasBlur = blurIntensity > 0
    const activeGradient = gradient || GRADIENT_WALLPAPER[source] || GRADIENT_WALLPAPER.pink

    return {
      source,
      sourceDark: store.sourceDark,
      type,
      typeDark: store.typeDark,
      hasPattern,
      hasPatternDark: store.hasPatternDark,
      patternId,
      patternIdDark: store.patternIdDark,
      patternIntensity,
      patternIntensityDark: store.patternIntensityDark,
      patternTone,
      patternToneDark: store.patternToneDark,
      hasTexture,
      hasTextureDark: store.hasTextureDark,
      hasBlur,
      blurIntensity,
      blurIntensityDark: store.blurIntensityDark,
      hasShadow,
      hasShadowDark: store.hasShadowDark,
      brightness,
      brightnessDark: store.brightnessDark,
      saturation,
      saturationDark: store.saturationDark,
      gradient: activeGradient,
      gradientDark: store.gradientDark,
      texture,
      textureDark: store.textureDark,
      gradientWallpapers: getGradientWallpapers(),
      patternWallpapers: getPatternWallpapers(),
      bgSize,
      bgSizeDark: store.bgSizeDark,
    }
  }

  const changeWallpaper = (source: string): void =>
    store.commit(toWallpaperThemePatch({ source }, isDarkTheme))

  const changePatternWallpaper = (source: string): void =>
    store.commit(toWallpaperThemePatch({ source, type: WALLPAPER_TYPE.PATTERN }, isDarkTheme))

  return {
    source: resolveWallpaperThemeState(store, isDarkTheme).source,
    changeWallpaper,
    changePatternWallpaper,
    getGradientWallpapers,
    getPatternWallpapers,
    getWallpaper,
  }
}
