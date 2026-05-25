'use client'

import { clone, forEach, keys } from 'ramda'
import { useMemo } from 'react'

import { GRADIENT_WALLPAPER, PATTERN_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import type {
  TCustomWallpaper,
  TWallpaperFmt,
  TWallpaperGradient,
  TWallpaperGradientDir,
  TWallpaperPic,
} from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import { parseWallpaper } from '~/wallpaper'

type TRet = { source: string; hasShadow: boolean } & TWallpaperFmt

export default function useWallpaper(): TRet {
  const store = useWallpaperDomain()
  const { source, hasPattern, hasBlur, hasShadow, direction, customColorValue, type, bgSize } =
    store

  const customWallpaper = useMemo((): TCustomWallpaper => {
    if (type === WALLPAPER_TYPE.CUSTOM_GRADIENT) {
      const customColors = customColorValue.split(',').map((c: string) => c.trim())

      return {
        colors: customColors,
        hasPattern,
        hasBlur,
        direction: direction as TWallpaperGradientDir,
      }
    }

    if (type === WALLPAPER_TYPE.UPLOAD && source) {
      return {
        bgImage: source,
        bgSize,
        hasBlur,
      }
    }

    return null
  }, [type, customColorValue, hasPattern, hasBlur, direction, source, bgSize])

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
    return parseWallpaper(wallpapers, source, customWallpaper)
  }, [wallpapers, source, customWallpaper])

  return {
    source,
    hasShadow,
    effect,
    background,
  }
}
