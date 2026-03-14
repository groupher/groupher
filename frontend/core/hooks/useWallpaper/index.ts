import { clone, forEach, keys } from 'ramda'
import { useMemo } from 'react'

import { GRADIENT_WALLPAPER, PATTERN_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import useWallpaperDomain from '~/hooks/useWallpaper.domain'
import type {
  TCustomWallpaper,
  TWallpaperFmt,
  TWallpaperGradient,
  TWallpaperGradientDir,
  TWallpaperPic,
} from '~/spec'

import { parseWallpaper } from '~/wallpaper'

type TRet = { wallpaper: string; hasShadow: boolean } & TWallpaperFmt

export default function useWallpaper(): TRet {
  const store = useWallpaperDomain()

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
