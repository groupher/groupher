import { clone, forEach, keys } from 'ramda'
import { useCallback } from 'react'
import { GRADIENT_WALLPAPER, PATTERN_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import useWallpaperDomain from '~/hooks/useWallpaper.domain'
import type {
  TWallpaper,
  TWallpaperData,
  TWallpaperGradient,
  TWallpaperGradientDir,
  TWallpaperPic,
} from '~/spec'

type TRet = {
  wallpaper: string
  changeWallpaper: (wallpaper: string) => void
  changePatternWallpaper: (wallpaper: string) => void
  getWallpaper: () => TWallpaperData
  getGradientWallpapers: () => Record<string, TWallpaper>
  getPatternWallpapers: () => Record<string, TWallpaper>
}

export default (): TRet => {
  const store = useWallpaperDomain()

  const getGradientWallpapers = useCallback((): Record<string, TWallpaper> => {
    const wallpapers = clone(GRADIENT_WALLPAPER)
    const paperKeys = keys(GRADIENT_WALLPAPER)

    forEach((key) => {
      const wallpaperObj = wallpapers[key] as TWallpaperGradient
      const { hasPattern, hasBlur, direction } = store

      wallpaperObj.hasPattern = hasPattern
      wallpaperObj.hasBlur = hasBlur
      wallpaperObj.direction = direction as TWallpaperGradientDir
    }, paperKeys)

    return wallpapers
  }, [store])

  const getPatternWallpapers = useCallback((): Record<string, TWallpaper> => {
    const wallpapers = clone(PATTERN_WALLPAPER)
    const paperKeys = keys(PATTERN_WALLPAPER)

    forEach((key) => {
      const wallpaperObj = wallpapers[key] as TWallpaperPic
      wallpaperObj.hasBlur = store.hasBlur
    }, paperKeys)

    return wallpapers
  }, [store])

  const getWallpaper = useCallback((): TWallpaperData => {
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
  }, [store, getGradientWallpapers, getPatternWallpapers])

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
