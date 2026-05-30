'use client'

import { useMemo } from 'react'

import {
  GRADIENT_WALLPAPER,
  PATTERN_WALLPAPER,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import {
  buildActiveGradientWallpapers,
  buildActivePatternWallpapers,
} from '~/hooks/useFullWallpaper/helper'
import {
  GRADIENT_RENDERER,
  isMeshGradientRecipe,
  normalizeMeshRecipe,
  normalizeEvenGradientStops,
  normalizeGradientStops,
  normalizeTexture,
  WALLPAPER_TEXTURE,
} from '~/lib/wallpaperMesh'
import { WALLPAPER_RENDER_KIND } from '~/lib/wallpaperRenderer/constant'
import type { TWallpaperRenderDescriptor } from '~/lib/wallpaperRenderer/spec'
import type { TCustomWallpaper, TWallpaperFmt, TWallpaperPic } from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TStore } from '~/stores/wallpaper/spec'
import type { TWallpaperState } from '~/stores/wallpaper/spec'
import { parseGradientRecipe, parseWallpaper, resolveWallpaperPattern } from '~/wallpaper'

type TRet = { source: string; hasShadow: boolean } & TWallpaperFmt

const DEFAULT_RENDER_COLORS = ['#fbeede', '#d8b9e3']

const getFilterValue = (effect: string): string =>
  effect.replace(/^filter:\s*/, '').trim() || 'none'

const getPatternOpacity = (patternIntensity: number): number =>
  Math.max(0, Math.min(100, patternIntensity)) / 100

const getPatternColor = (patternTone: TWallpaperState['patternTone']): string =>
  patternTone === WALLPAPER_PATTERN_TONE.LIGHT ? '#ffffff' : '#000000'

export const getWallpaperState = (store: Pick<TStore, keyof TWallpaperState>): TWallpaperState => ({
  source: store.source,
  hasPattern: store.hasPattern,
  patternId: store.patternId,
  patternIntensity: store.patternIntensity,
  patternTone: store.patternTone,
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
  patternId: store.patternId,
  patternIntensity: store.patternIntensity,
  patternTone: store.patternTone,
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

// Renderer draws pattern as a separate opacity-controlled overlay; keep the
// fallback background pattern-free so first paint cannot flash a 100% pattern.
const getWallpaperRendererFallbackState = (state: TWallpaperState): TWallpaperState =>
  state.type === WALLPAPER_TYPE.GRADIENT && state.hasPattern
    ? { ...state, hasPattern: false }
    : state

export const resolveWallpaper = (state: TWallpaperState): TRet => {
  const {
    source,
    hasPattern,
    patternId,
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
      patternId,
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
  const { background, effect } = resolveWallpaper(getWallpaperRendererFallbackState(state))
  const base = {
    background: background || 'transparent',
    filter: getFilterValue(effect),
    hasPattern: false,
    patternImage: resolveWallpaperPattern(state.patternId),
    patternOpacity: getPatternOpacity(state.patternIntensity),
    patternColor: getPatternColor(state.patternTone),
    hasTexture: state.hasTexture,
    source: state.source,
    bgSize: state.bgSize,
    colors: DEFAULT_RENDER_COLORS,
    colorStops: normalizeEvenGradientStops(DEFAULT_RENDER_COLORS.length),
    flow: state.gradient?.renderer === GRADIENT_RENDERER.LINEAR ? state.gradient.angle : 180,
    texture: normalizeTexture(state.texture),
    blurIntensity: state.blurIntensity,
    brightness: state.brightness,
    saturation: state.saturation,
    gradientRecipe: null,
    meshRecipe: null,
    imageUrl: '',
  }

  if (state.type === WALLPAPER_TYPE.NONE) {
    return { ...base, kind: WALLPAPER_RENDER_KIND.NONE }
  }

  if (state.type === WALLPAPER_TYPE.GRADIENT) {
    const gradient = state.gradient || GRADIENT_WALLPAPER[state.source]
    if (!gradient) return { ...base, kind: WALLPAPER_RENDER_KIND.NONE }

    if (isMeshGradientRecipe(gradient)) {
      const meshRecipe = normalizeMeshRecipe(gradient)
      return {
        ...base,
        kind: WALLPAPER_RENDER_KIND.MESH_GRADIENT,
        hasPattern: state.hasPattern,
        patternImage: resolveWallpaperPattern(state.patternId),
        patternOpacity: getPatternOpacity(state.patternIntensity),
        patternColor: getPatternColor(state.patternTone),
        hasTexture: state.hasTexture,
        colors: meshRecipe.colors,
        colorStops: normalizeGradientStops(meshRecipe),
        flow: meshRecipe.angle,
        meshRecipe,
      }
    }

    return {
      ...base,
      kind:
        gradient.renderer === GRADIENT_RENDERER.RADIAL
          ? WALLPAPER_RENDER_KIND.RADIAL_GRADIENT
          : WALLPAPER_RENDER_KIND.LINEAR_GRADIENT,
      hasPattern: state.hasPattern,
      patternImage: resolveWallpaperPattern(state.patternId),
      patternOpacity: getPatternOpacity(state.patternIntensity),
      patternColor: getPatternColor(state.patternTone),
      hasTexture: state.hasTexture,
      colors: gradient.colors,
      colorStops: normalizeGradientStops(gradient),
      flow: gradient.renderer === GRADIENT_RENDERER.LINEAR ? gradient.angle : 180,
      gradientRecipe: gradient,
    }
  }

  if (!state.source) {
    return { ...base, kind: WALLPAPER_RENDER_KIND.NONE }
  }

  if (state.type === WALLPAPER_TYPE.PATTERN) {
    const wallpaper = PATTERN_WALLPAPER[state.source] as TWallpaperPic | undefined

    return {
      ...base,
      kind: wallpaper?.image ? WALLPAPER_RENDER_KIND.IMAGE : WALLPAPER_RENDER_KIND.NONE,
      imageUrl: wallpaper?.image || '',
    }
  }

  if (state.type === WALLPAPER_TYPE.UPLOAD) {
    return {
      ...base,
      kind: state.source ? WALLPAPER_RENDER_KIND.IMAGE : WALLPAPER_RENDER_KIND.NONE,
      imageUrl: state.source,
    }
  }

  return { ...base, kind: WALLPAPER_RENDER_KIND.NONE }
}

export default function useWallpaper(): TRet {
  const store = useWallpaperDomain()
  const state = getWallpaperCssState(store)

  return useMemo(
    () => resolveWallpaper(state),
    [
      state.source,
      state.hasPattern,
      state.patternId,
      state.patternIntensity,
      state.patternTone,
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
      state.patternId,
      state.patternIntensity,
      state.patternTone,
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
