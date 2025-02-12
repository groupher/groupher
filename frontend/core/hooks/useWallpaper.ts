import { useMemo } from 'react'
import { keys, clone, forEach } from 'ramda'

import { WALLPAPER_TYPE, GRADIENT_WALLPAPER, PATTERN_WALLPAPER } from '~/const/wallpaper'

import type {
  TWallpaperFmt,
  TWallpaperGradientDir,
  TCustomWallpaper,
  TWallpaperPic,
  TWallpaperGradient,
} from '~/spec'
import useSubStore from '~/hooks/useSubStore'

import { parseWallpaper } from '~/wallpaper'

type TRet = { wallpaper: string; hasShadow: boolean } & TWallpaperFmt

export default (): TRet => {
  const store = useSubStore('wallpaper')

  const { wallpaper, hasPattern, hasBlur, hasShadow, direction, customColorValue, wallpaperType } =
    store

  const customWallpaper = useMemo((): TCustomWallpaper => {
    if (wallpaperType === WALLPAPER_TYPE.CUSTOM_GRADIENT) {
      const customColors = customColorValue.split(',').map((c: string) => c.trim())

      return {
        colors: customColors,
        hasPattern,
        hasBlur,
        hasShadow,
        direction: direction as TWallpaperGradientDir,
      }
    }

    return null
  }, [wallpaperType, customColorValue, hasPattern, hasBlur, hasShadow, direction])

  const patternWallpapers = useMemo(() => {
    const wallpapers = clone(PATTERN_WALLPAPER)
    const paperKeys = keys(PATTERN_WALLPAPER)

    forEach((key) => {
      const wallpaperObj = wallpapers[key] as TWallpaperPic
      wallpaperObj.hasBlur = hasBlur
    }, paperKeys)

    return wallpapers
  }, [hasBlur])

  const gradientWallpapers = useMemo(() => {
    const wallpapers = clone(GRADIENT_WALLPAPER)
    const paperKeys = keys(GRADIENT_WALLPAPER)

    forEach((key) => {
      const wallpaperObj = wallpapers[key] as TWallpaperGradient

      wallpaperObj.hasPattern = hasPattern
      wallpaperObj.hasBlur = hasBlur
      wallpaperObj.direction = direction as TWallpaperGradientDir
    }, paperKeys)

    return wallpapers
  }, [hasBlur, hasPattern, direction])

  const wallpapers = useMemo(() => {
    return { ...gradientWallpapers, ...patternWallpapers }
  }, [gradientWallpapers, patternWallpapers])

  const { background, effect } = useMemo(() => {
    return parseWallpaper(wallpapers, wallpaper, customWallpaper)
  }, [wallpapers, wallpaper, customWallpaper])

  return {
    wallpaper,
    hasShadow,
    effect,
    background,
  }
}
