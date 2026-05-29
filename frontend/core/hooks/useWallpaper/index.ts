'use client'

import { useMemo } from 'react'

import { GRADIENT_WALLPAPER, PATTERN_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import {
  buildActiveGradientWallpapers,
  buildActivePatternWallpapers,
} from '~/hooks/useFullWallpaper/helper'
import {
  GRADIENT_TYPE,
  normalizeEvenGradientStops,
  normalizeGradientStops,
  normalizeTexture,
  WALLPAPER_TEXTURE,
} from '~/lib/wallpaperMesh'
import type { TWallpaperRenderDescriptor } from '~/lib/wallpaperRenderer/spec'
import type { TCustomWallpaper, TWallpaperFmt, TWallpaperPic } from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TStore } from '~/stores/wallpaper/spec'
import type { TWallpaperState } from '~/stores/wallpaper/spec'
import { parseGradientRecipe, parseWallpaper } from '~/wallpaper'

type TRet = { source: string; hasShadow: boolean } & TWallpaperFmt

const DEFAULT_RENDER_COLORS = ['#fbeede', '#d8b9e3']

const getFilterValue = (effect: string): string =>
  effect.replace(/^filter:\s*/, '').trim() || 'none'

export const getWallpaperState = (store: Pick<TStore, keyof TWallpaperState>): TWallpaperState => ({
  source: store.source,
  hasPattern: store.hasPattern,
  hasTexture: store.hasTexture,
  gradient: store.gradient,
  blurIntensity: store.blurIntensity,
  hasShadow: store.hasShadow,
  brightness: store.brightness,
  saturation: store.saturation,
  texture: store.texture,
  customWallpaper: store.customWallpaper,
  type: store.type,
  bgSize: store.bgSize,
})

const getWallpaperCssState = (store: Pick<TStore, keyof TWallpaperState>): TWallpaperState => ({
  source: store.source,
  hasPattern: store.hasPattern,
  hasTexture: store.hasTexture,
  gradient: store.gradient,
  blurIntensity: store.blurIntensity,
  hasShadow: store.hasShadow,
  brightness: store.brightness,
  saturation: store.saturation,
  texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
  customWallpaper: store.customWallpaper,
  type: store.type,
  bgSize: store.bgSize,
})

export const resolveWallpaper = (state: TWallpaperState): TRet => {
  const {
    source,
    hasPattern,
    blurIntensity,
    hasShadow,
    brightness,
    saturation,
    gradient,
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
    gradient,
  })

  const wallpapers = { ...gradientWallpapers, ...patternWallpapers }
  const activeGradient = gradient || gradientWallpapers[source]
  if (type === WALLPAPER_TYPE.GRADIENT && activeGradient) {
    const parsed = parseGradientRecipe(activeGradient, {
      hasPattern,
      blurIntensity,
      brightness,
      saturation,
    })
    return {
      source,
      hasShadow,
      ...parsed,
    }
  }

  const parsed = parseWallpaper(wallpapers, source, customWallpaper)

  return {
    source,
    hasShadow,
    ...parsed,
  }
}

export const resolveWallpaperRenderDescriptor = (
  state: TWallpaperState,
): TWallpaperRenderDescriptor => {
  const { background, effect } = resolveWallpaper(state)
  const base = {
    background: background || 'transparent',
    filter: getFilterValue(effect),
    hasPattern: false,
    hasTexture: state.hasTexture,
    source: state.source,
    bgSize: state.bgSize,
    colors: DEFAULT_RENDER_COLORS,
    colorStops: normalizeEvenGradientStops(DEFAULT_RENDER_COLORS.length),
    flow: state.gradient?.kind === GRADIENT_TYPE.LINEAR ? state.gradient.angle : 180,
    texture: normalizeTexture(state.texture),
    blurIntensity: state.blurIntensity,
    brightness: state.brightness,
    saturation: state.saturation,
    gradientRecipe: null,
    meshRecipe: null,
    imageUrl: '',
  }

  if (state.type === WALLPAPER_TYPE.NONE) {
    return { ...base, kind: 'none' }
  }

  if (state.type === WALLPAPER_TYPE.GRADIENT) {
    const gradient = state.gradient || GRADIENT_WALLPAPER[state.source]
    if (!gradient) return { ...base, kind: 'none' }

    if (gradient.kind === GRADIENT_TYPE.MESH) {
      return {
        ...base,
        kind: 'mesh-gradient',
        hasPattern: state.hasPattern,
        hasTexture: state.hasTexture,
        colors: gradient.colors,
        colorStops: normalizeGradientStops(gradient),
        flow: gradient.flow,
        meshRecipe: gradient,
      }
    }

    return {
      ...base,
      kind: gradient.kind === GRADIENT_TYPE.RADIAL ? 'radial-gradient' : 'linear-gradient',
      hasPattern: state.hasPattern,
      hasTexture: state.hasTexture,
      colors: gradient.colors,
      colorStops: normalizeGradientStops(gradient),
      flow: gradient.kind === GRADIENT_TYPE.LINEAR ? gradient.angle : 180,
      gradientRecipe: gradient,
    }
  }

  if (!state.source) {
    return { ...base, kind: 'none' }
  }

  if (state.type === WALLPAPER_TYPE.PATTERN) {
    const wallpaper = PATTERN_WALLPAPER[state.source] as TWallpaperPic | undefined

    return {
      ...base,
      kind: wallpaper?.image ? 'image' : 'none',
      imageUrl: wallpaper?.image || '',
    }
  }

  if (state.type === WALLPAPER_TYPE.UPLOAD) {
    return {
      ...base,
      kind: state.source ? 'image' : 'none',
      imageUrl: state.source,
    }
  }

  return { ...base, kind: 'none' }
}

export default function useWallpaper(): TRet {
  const store = useWallpaperDomain()
  const state = getWallpaperCssState(store)

  return useMemo(
    () => resolveWallpaper(state),
    [
      state.source,
      state.hasPattern,
      state.blurIntensity,
      state.hasShadow,
      state.brightness,
      state.saturation,
      state.gradient,
      state.customWallpaper,
      state.type,
      state.bgSize,
    ],
  )
}

export function useWallpaperRenderDescriptor(): TWallpaperRenderDescriptor {
  const store = useWallpaperDomain()
  const state = getWallpaperState(store)

  return useMemo(
    () => resolveWallpaperRenderDescriptor(state),
    [
      state.source,
      state.hasPattern,
      state.hasTexture,
      state.blurIntensity,
      state.hasShadow,
      state.brightness,
      state.saturation,
      state.texture,
      state.gradient,
      state.customWallpaper,
      state.type,
      state.bgSize,
    ],
  )
}
