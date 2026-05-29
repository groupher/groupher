import { GRADIENT_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TWallpaper, TWallpaperData } from '~/spec'
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

  const getGradientWallpapers = (): Record<string, TGradientRecipe> => {
    return buildGradientCatalogWallpapers()
  }

  const getPatternWallpapers = (): Record<string, TWallpaper> => {
    return buildPatternCatalogWallpapers()
  }

  const getWallpaper = (): TWallpaperData => {
    const {
      gradient,
      hasPattern,
      hasTexture,
      blurIntensity,
      hasShadow,
      brightness,
      saturation,
      texture,
      source,
      type,
      bgSize,
    } = store

    const hasBlur = blurIntensity > 0
    const activeGradient = gradient || GRADIENT_WALLPAPER[source] || GRADIENT_WALLPAPER.pink

    return {
      source,
      type,
      hasPattern,
      hasTexture,
      hasBlur,
      blurIntensity,
      hasShadow,
      brightness,
      saturation,
      gradient: activeGradient,
      texture,
      gradientWallpapers: getGradientWallpapers(),
      patternWallpapers: getPatternWallpapers(),
      bgSize,
    }
  }

  const changeWallpaper = (source: string): void => store.commit({ source })

  const changePatternWallpaper = (source: string): void =>
    store.commit({ source, type: WALLPAPER_TYPE.PATTERN })

  return {
    source: store.source,
    changeWallpaper,
    changePatternWallpaper,
    getGradientWallpapers,
    getPatternWallpapers,
    getWallpaper,
  }
}
