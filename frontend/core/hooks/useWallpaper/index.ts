'use client'

import { useMemo } from 'react'

import { GRADIENT_WALLPAPER, PATTERN_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import {
  buildActiveGradientWallpapers,
  buildActivePatternWallpapers,
} from '~/hooks/useFullWallpaper/helper'
import {
  buildMeshGradientFallback,
  normalizeTexture,
  parseMeshGradientValue,
  renderMeshGradientDataUrl,
} from '~/lib/wallpaperMesh'
import type { TWallpaperRenderDescriptor } from '~/lib/wallpaperRenderer/types'
import type {
  TCustomWallpaper,
  TWallpaperFmt,
  TWallpaperGradient,
  TWallpaperGradientDir,
  TWallpaperPic,
} from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TStore } from '~/stores/wallpaper/spec'
import type { TWallpaperState } from '~/stores/wallpaper/spec'
import { parseWallpaper } from '~/wallpaper'

type TRet = { source: string; hasShadow: boolean } & TWallpaperFmt
type TResolveOptions = {
  renderMeshDataUrl?: boolean
}

const DEFAULT_RENDER_COLORS = ['#fbeede', '#d8b9e3']

const parseRenderFlow = (direction = '180deg'): number => {
  const direction$ = direction.trim().toLowerCase()
  const legacy: Record<string, number> = {
    top: 0,
    'top right': 45,
    right: 90,
    'bottom right': 135,
    bottom: 180,
    'bottom left': 225,
    left: 270,
    'top left': 315,
  }

  if (direction$ in legacy) return legacy[direction$]

  const match = direction$.match(/^(-?\d+(?:\.\d+)?)deg$/)
  if (!match) return 180

  return Math.round(((Number(match[1]) % 360) + 360) % 360)
}

const getFilterValue = (effect: string): string =>
  effect.replace(/^filter:\s*/, '').trim() || 'none'

export const getWallpaperState = (store: Pick<TStore, keyof TWallpaperState>): TWallpaperState => ({
  source: store.source,
  hasPattern: store.hasPattern,
  blurIntensity: store.blurIntensity,
  hasShadow: store.hasShadow,
  brightness: store.brightness,
  saturation: store.saturation,
  textureType: store.textureType,
  textureStrength: store.textureStrength,
  direction: store.direction,
  customColorValue: store.customColorValue,
  customWallpaper: store.customWallpaper,
  type: store.type,
  bgSize: store.bgSize,
})

const getWallpaperCssState = (store: Pick<TStore, keyof TWallpaperState>): TWallpaperState => ({
  source: store.source,
  hasPattern: store.hasPattern,
  blurIntensity: store.blurIntensity,
  hasShadow: store.hasShadow,
  brightness: store.brightness,
  saturation: store.saturation,
  textureType: 'grain',
  textureStrength: 0,
  direction: store.direction,
  customColorValue: store.customColorValue,
  customWallpaper: store.customWallpaper,
  type: store.type,
  bgSize: store.bgSize,
})

export const resolveWallpaper = (
  state: TWallpaperState,
  { renderMeshDataUrl = false }: TResolveOptions = {},
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

export const resolveWallpaperRenderDescriptor = (
  state: TWallpaperState,
): TWallpaperRenderDescriptor => {
  const { background, effect } = resolveWallpaper(state, { renderMeshDataUrl: false })
  const base = {
    background: background || 'transparent',
    filter: getFilterValue(effect),
    hasPattern: false,
    source: state.source,
    bgSize: state.bgSize,
    colors: DEFAULT_RENDER_COLORS,
    flow: parseRenderFlow(state.direction),
    texture: normalizeTexture({
      type: state.textureType,
      strength: state.textureStrength,
    }),
    blurIntensity: state.blurIntensity,
    brightness: state.brightness,
    saturation: state.saturation,
    meshRecipe: null,
    imageUrl: '',
  }

  if (state.type === WALLPAPER_TYPE.NONE) {
    return { ...base, kind: 'none' }
  }

  if (state.type === WALLPAPER_TYPE.CUSTOM_GRADIENT) {
    const meshRecipe = parseMeshGradientValue(state.customColorValue)

    if (meshRecipe) {
      return {
        ...base,
        kind: 'mesh-gradient',
        hasPattern: state.hasPattern,
        colors: meshRecipe.colors,
        flow: meshRecipe.flow,
        texture: meshRecipe.texture,
        meshRecipe,
      }
    }

    const colors = state.customColorValue
      .split(',')
      .map((color) => color.trim())
      .filter(Boolean)

    return {
      ...base,
      kind: 'linear-gradient',
      hasPattern: state.hasPattern,
      colors: colors.length ? colors : DEFAULT_RENDER_COLORS,
    }
  }

  if (!state.source) {
    return { ...base, kind: 'none' }
  }

  if (state.type === WALLPAPER_TYPE.GRADIENT) {
    const wallpaper = GRADIENT_WALLPAPER[state.source] as TWallpaperGradient | undefined

    return {
      ...base,
      kind: 'linear-gradient',
      hasPattern: state.hasPattern,
      colors: wallpaper?.colors?.length ? wallpaper.colors : DEFAULT_RENDER_COLORS,
    }
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
      state.direction,
      state.customColorValue,
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
      state.blurIntensity,
      state.hasShadow,
      state.brightness,
      state.saturation,
      state.textureType,
      state.textureStrength,
      state.direction,
      state.customColorValue,
      state.customWallpaper,
      state.type,
      state.bgSize,
    ],
  )
}
