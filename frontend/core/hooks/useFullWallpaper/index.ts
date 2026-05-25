import { clone, keys } from 'ramda'

import { GRADIENT_WALLPAPER, PATTERN_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import type {
  TWallpaper,
  TWallpaperData,
  TWallpaperGradient,
  TWallpaperGradientDir,
  TWallpaperPic,
} from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

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
    const wallpapers = clone(GRADIENT_WALLPAPER)
    for (const key of keys(GRADIENT_WALLPAPER)) {
      const wallpaperObj = wallpapers[key] as TWallpaperGradient
      wallpaperObj.hasPattern = store.hasPattern
      wallpaperObj.hasBlur = store.hasBlur
      wallpaperObj.direction = store.direction as TWallpaperGradientDir
    }
    return wallpapers
  }

  const getPatternWallpapers = (): Record<string, TWallpaper> => {
    const wallpapers = clone(PATTERN_WALLPAPER)
    for (const key of keys(PATTERN_WALLPAPER)) {
      const wallpaperObj = wallpapers[key] as TWallpaperPic
      wallpaperObj.hasBlur = store.hasBlur
    }
    return wallpapers
  }

  const getWallpaper = (): TWallpaperData => {
    const { customColorValue, direction, hasPattern, hasBlur, hasShadow, source, type, bgSize } =
      store

    return {
      source,
      type,
      hasPattern,
      hasBlur,
      hasShadow,
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
