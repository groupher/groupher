'use client'

import { useMemo } from 'react'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import {
  buildActiveGradientWallpapers,
  buildActivePatternWallpapers,
} from '~/hooks/useFullWallpaper/helper'
import type { TCustomWallpaper, TWallpaperFmt, TWallpaperGradientDir } from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import { parseWallpaper } from '~/wallpaper'

type TRet = { source: string; hasShadow: boolean } & TWallpaperFmt

export default function useWallpaper(): TRet {
  const store = useWallpaperDomain()
  const {
    source,
    hasPattern,
    hasBlur,
    hasShadow,
    brightness,
    saturation,
    direction,
    customColorValue,
    type,
    bgSize,
  } = store

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
        image: source,
        bgSize,
        hasBlur,
        brightness,
        saturation,
      }
    }

    return null
  }, [
    type,
    customColorValue,
    hasPattern,
    hasBlur,
    direction,
    source,
    bgSize,
    brightness,
    saturation,
  ])

  const patternWallpapers = useMemo(() => {
    return buildActivePatternWallpapers({ source, type, hasBlur, brightness, saturation })
  }, [source, type, hasBlur, brightness, saturation])

  const gradientWallpapers = useMemo(() => {
    return buildActiveGradientWallpapers({
      source,
      type,
      hasPattern,
      hasBlur,
      direction: direction as TWallpaperGradientDir,
    })
  }, [source, type, hasBlur, hasPattern, direction])

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
