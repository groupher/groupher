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
  wallpaper: string
  changeWallpaper: (wallpaper: string) => void
  changePatternWallpaper: (wallpaper: string) => void
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
    const {
      customColorValue,
      direction,
      hasPattern,
      hasBlur,
      hasShadow,
      wallpaper,
      wallpaperType,
    } = store

    return {
      wallpaper,
      wallpaperType,
      hasPattern,
      hasBlur,
      hasShadow,
      gradientWallpapers: getGradientWallpapers(),
      patternWallpapers: getPatternWallpapers(),
      customColor: customColorValue,
      direction,
    }
  }

  const changeWallpaper = (wallpaper: string): void => store.commit({ wallpaper })

  const changePatternWallpaper = (wallpaper: string): void =>
    store.commit({ wallpaper, wallpaperType: WALLPAPER_TYPE.PATTERN })

  return {
    wallpaper: store.wallpaper,
    changeWallpaper,
    changePatternWallpaper,
    getGradientWallpapers,
    getPatternWallpapers,
    getWallpaper,
  }
}
