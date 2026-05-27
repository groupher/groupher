'use client'

import { useMemo } from 'react'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import {
  buildActiveGradientWallpapers,
  buildActivePatternWallpapers,
} from '~/hooks/useFullWallpaper/helper'
import {
  buildMeshGradientFallback,
  parseMeshGradientValue,
  renderMeshGradientDataUrl,
} from '~/lib/wallpaperMesh'
import type { TCustomWallpaper, TWallpaperFmt, TWallpaperGradientDir } from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TWallpaperState } from '~/stores/wallpaper/spec'
import { parseWallpaper } from '~/wallpaper'

type TRet = { source: string; hasShadow: boolean } & TWallpaperFmt
type TResolveOptions = {
  renderMeshDataUrl?: boolean
}

export const resolveWallpaper = (
  state: TWallpaperState,
  { renderMeshDataUrl = true }: TResolveOptions = {},
): TRet => {
  const {
    source,
    hasPattern,
    blurIntensity,
    hasShadow,
    brightness,
    saturation,
    direction,
    customColorValue,
    customWallpaper: customWallpaperValue,
    type,
    bgSize,
  } = state
  let customWallpaper: TCustomWallpaper = null

  if (
    (type === WALLPAPER_TYPE.PATTERN || type === WALLPAPER_TYPE.GRADIENT) &&
    customWallpaperValue &&
    'image' in customWallpaperValue
  ) {
    customWallpaper = {
      ...customWallpaperValue,
      blurIntensity,
      brightness,
      saturation,
    }
  }

  if (type === WALLPAPER_TYPE.CUSTOM_GRADIENT) {
    const meshRecipe = parseMeshGradientValue(customColorValue)
    if (meshRecipe) {
      customWallpaper = {
        colors: meshRecipe.colors,
        hasPattern,
        blurIntensity,
        brightness,
        saturation,
        direction: `${meshRecipe.flow}deg`,
      }
    } else {
      const customColors = customColorValue.split(',').map((c: string) => c.trim())

      customWallpaper = {
        colors: customColors,
        hasPattern,
        blurIntensity,
        brightness,
        saturation,
        direction: direction as TWallpaperGradientDir,
      }
    }
  }

  if (type === WALLPAPER_TYPE.UPLOAD && source) {
    customWallpaper = {
      image: source,
      bgSize,
      blurIntensity,
      brightness,
      saturation,
    }
  }

  const patternWallpapers = buildActivePatternWallpapers({
    source,
    type,
    blurIntensity,
    brightness,
    saturation,
  })

  const gradientWallpapers = buildActiveGradientWallpapers({
    source,
    type,
    hasPattern,
    blurIntensity,
    brightness,
    saturation,
    direction: direction as TWallpaperGradientDir,
  })

  const wallpapers = { ...gradientWallpapers, ...patternWallpapers }
  const meshRecipe =
    type === WALLPAPER_TYPE.CUSTOM_GRADIENT && parseMeshGradientValue(customColorValue)
  const parsed = parseWallpaper(wallpapers, source, customWallpaper)

  if (meshRecipe) {
    const meshBackground = renderMeshDataUrl
      ? renderMeshGradientDataUrl(meshRecipe) || buildMeshGradientFallback(meshRecipe)
      : buildMeshGradientFallback(meshRecipe)

    return {
      source,
      hasShadow,
      ...parsed,
      background: hasPattern
        ? `url(/wallpaper/pattern/1.png) repeat, ${meshBackground}`
        : meshBackground,
    }
  }

  return {
    source,
    hasShadow,
    ...parsed,
  }
}

export default function useWallpaper(): TRet {
  const store = useWallpaperDomain()
  const state = {
    source: store.source,
    hasPattern: store.hasPattern,
    blurIntensity: store.blurIntensity,
    hasShadow: store.hasShadow,
    brightness: store.brightness,
    saturation: store.saturation,
    direction: store.direction,
    customColorValue: store.customColorValue,
    customWallpaper: store.customWallpaper,
    type: store.type,
    bgSize: store.bgSize,
  }

  return useMemo(
    () => resolveWallpaper(state),
    [
      state.source,
      state.hasPattern,
      state.blurIntensity,
      state.hasShadow,
      state.brightness,
      state.saturation,
      state.direction,
      state.customColorValue,
      state.customWallpaper,
      state.type,
      state.bgSize,
    ],
  )
}
