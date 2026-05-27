import { WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TWallpaper, TWallpaperData } from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

import { buildGradientCatalogWallpapers, buildPatternCatalogWallpapers } from './helper'

type TRet = {
  source: string
  changeWallpaper: (source: string) => void
  changePatternWallpaper: (source: string) => void
  getWallpaper: () => TWallpaperData
  getGradientWallpapers: () => Record<string, TWallpaper>
  getPatternWallpapers: () => Record<string, TWallpaper>
}

export default function useFullWallpaper(): TRet {
  const store = useWallpaperDomain()

  const getGradientWallpapers = (): Record<string, TWallpaper> => {
    return buildGradientCatalogWallpapers()
  }

  const getPatternWallpapers = (): Record<string, TWallpaper> => {
    return buildPatternCatalogWallpapers()
  }

  const getWallpaper = (): TWallpaperData => {
    const {
      customColorValue,
      direction,
      hasPattern,
      blurIntensity,
      hasShadow,
      brightness,
      saturation,
      textureType,
      textureStrength,
      source,
      type,
      bgSize,
    } = store

    const hasBlur = blurIntensity > 0

    return {
      source,
      type,
      hasPattern,
      hasBlur,
      blurIntensity,
      hasShadow,
      brightness,
      saturation,
      textureType,
      textureStrength,
      gradientWallpapers: getGradientWallpapers(),
      patternWallpapers: getPatternWallpapers(),
      customColor: customColorValue,
      direction,
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
