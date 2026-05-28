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
  renderMeshGradientDataUrl,
  WALLPAPER_TEXTURE,
} from '~/lib/wallpaperMesh'
import type { TWallpaperRenderDescriptor } from '~/lib/wallpaperRenderer/spec'
import type { TCustomWallpaper, TWallpaperFmt, TWallpaperGradient, TWallpaperPic } from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TStore } from '~/stores/wallpaper/spec'
import type { TWallpaperState } from '~/stores/wallpaper/spec'
import { parseWallpaper } from '~/wallpaper'

type TRet = { source: string; hasShadow: boolean } & TWallpaperFmt
type TResolveOptions = {
  renderMeshDataUrl?: boolean
}

const DEFAULT_RENDER_COLORS = ['#fbeede', '#d8b9e3']

const getFilterValue = (effect: string): string =>
  effect.replace(/^filter:\s*/, '').trim() || 'none'

export const getWallpaperState = (store: Pick<TStore, keyof TWallpaperState>): TWallpaperState => ({
  source: store.source,
  hasPattern: store.hasPattern,
  gradientDeg: store.gradientDeg,
  blurIntensity: store.blurIntensity,
  hasShadow: store.hasShadow,
  brightness: store.brightness,
  saturation: store.saturation,
  mesh: store.mesh,
  texture: store.texture,
  customWallpaper: store.customWallpaper,
  type: store.type,
  bgSize: store.bgSize,
})

const getWallpaperCssState = (store: Pick<TStore, keyof TWallpaperState>): TWallpaperState => ({
  source: store.source,
  hasPattern: store.hasPattern,
  gradientDeg: store.gradientDeg,
  blurIntensity: store.blurIntensity,
  hasShadow: store.hasShadow,
  brightness: store.brightness,
  saturation: store.saturation,
  texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
  mesh: store.mesh,
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
    gradientDeg,
    mesh,
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

  if (type === WALLPAPER_TYPE.MESH && mesh) {
    customWallpaper = {
      colors: mesh.colors,
      hasPattern,
      blurIntensity,
      brightness,
      saturation,
      direction: `${mesh.flow}deg`,
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
    gradientDeg,
  })

  const wallpapers = { ...gradientWallpapers, ...patternWallpapers }
  const parsed = parseWallpaper(wallpapers, source, customWallpaper)

  if (type === WALLPAPER_TYPE.MESH && mesh) {
    const meshBackground = renderMeshDataUrl
      ? renderMeshGradientDataUrl(mesh) || buildMeshGradientFallback(mesh)
      : buildMeshGradientFallback(mesh)

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
    flow: state.gradientDeg,
    texture: normalizeTexture(state.texture),
    blurIntensity: state.blurIntensity,
    brightness: state.brightness,
    saturation: state.saturation,
    meshRecipe: null,
    imageUrl: '',
  }

  if (state.type === WALLPAPER_TYPE.NONE) {
    return { ...base, kind: 'none' }
  }

  if (state.type === WALLPAPER_TYPE.MESH) {
    if (!state.mesh) return { ...base, kind: 'none' }
    return {
      ...base,
      kind: 'mesh-gradient',
      hasPattern: state.hasPattern,
      colors: state.mesh.colors,
      flow: state.mesh.flow,
      meshRecipe: state.mesh,
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
      state.gradientDeg,
      state.mesh,
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
      state.texture,
      state.gradientDeg,
      state.mesh,
      state.customWallpaper,
      state.type,
      state.bgSize,
    ],
  )
}
