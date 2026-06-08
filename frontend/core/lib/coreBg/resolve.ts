import { WALLPAPER_PATTERN_TONE, WALLPAPER_TYPE } from '~/const/wallpaper'
import {
  GRADIENT_RENDERER,
  isMeshGradientRecipe,
  normalizeEvenGradientStops,
  normalizeGradientStops,
  normalizeMeshRecipe,
  normalizeTexture,
  type TGradientRecipe,
  WALLPAPER_TEXTURE,
} from '~/lib/wallpaperMesh'
import type { TWallpaperFmt, TWallpaperPic } from '~/spec'
import type { TStore, TWallpaperThemeState } from '~/stores/wallpaper/spec'

import { buildActiveCoreBgGradientWallpapers, buildActiveCoreBgPatternWallpapers } from './catalog'
import { CORE_BG_RENDER_KIND } from './constant'
import { parseCoreBgGradientRecipe, parseCoreBgWallpaper, resolveCoreBgPattern } from './parse'
import type { TCoreBgConfig, TCoreBgRenderSpec } from './spec'

type TResolvedCoreBg = { source: string } & TWallpaperFmt

const DEFAULT_RENDER_COLORS = ['#fbeede', '#d8b9e3']

const getFilterValue = (effect: string): string =>
  effect.replace(/^filter:\s*/, '').trim() || 'none'

const getPatternOpacity = (patternIntensity: number): number =>
  Math.max(0, Math.min(100, patternIntensity)) / 100

const getPatternColor = (patternTone: TWallpaperThemeState['patternTone']): string =>
  patternTone === WALLPAPER_PATTERN_TONE.LIGHT ? '#ffffff' : '#000000'

const getActiveCoreBgGradientRecipe = (config: TCoreBgConfig): TGradientRecipe | null => {
  const gradientWallpapers = buildActiveCoreBgGradientWallpapers({
    source: config.source,
    type: config.type,
    gradient: config.gradient,
  })

  return config.gradient || gradientWallpapers[config.source] || null
}

/**
 * Maps the current Wallpaper store shape into the common single-theme CoreBg shape.
 *
 * This is a compatibility adapter while Wallpaper still persists flat light/dark
 * fields. New consumers should prefer constructing `TCoreBgConfig` directly.
 *
 * @example
 * const bg = toCoreBgConfig(resolveWallpaperThemeState(store, isDarkTheme))
 */
export const toCoreBgConfig = (store: Pick<TStore, keyof TWallpaperThemeState>): TCoreBgConfig => ({
  source: store.source,
  hasPattern: store.hasPattern,
  patternId: store.patternId,
  patternIntensity: store.patternIntensity,
  patternTone: store.patternTone,
  hasTexture: store.hasTexture,
  gradient: store.gradient,
  blurIntensity: store.blurIntensity,
  brightness: store.brightness,
  saturation: store.saturation,
  texture: store.texture,
  customWallpaper: store.customWallpaper,
  type: store.type,
  bgSize: store.bgSize,
})

/**
 * Maps store state to the CSS fallback-only CoreBg config.
 *
 * Wallpaper's CSS hook intentionally ignores WebGL texture because the texture is
 * rendered by `CoreBgRenderer`, while CSS fallback only needs background/filter.
 *
 * @example
 * const cssBg = resolveCoreBg(toCoreBgCssConfig(wallpaperState))
 */
export const toCoreBgCssConfig = (
  store: Pick<TStore, keyof TWallpaperThemeState>,
): TCoreBgConfig => ({
  ...toCoreBgConfig(store),
  texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
})

/**
 * Resolves a CoreBg config to CSS-compatible background and filter strings.
 *
 * Use this for non-WebGL fallbacks and simple CSS consumers. Components that need
 * texture, mesh, or pattern overlay should use `resolveCoreBgRenderSpec`.
 *
 * @example
 * const { background, effect } = resolveCoreBg(bg)
 */
export const resolveCoreBg = (config: TCoreBgConfig): TResolvedCoreBg => {
  const {
    source,
    hasPattern,
    patternId,
    blurIntensity,
    brightness,
    saturation,
    gradient,
    customWallpaper: customWallpaperValue,
    type,
    bgSize,
  } = config
  let customWallpaper = customWallpaperValue

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

  const patternWallpapers = buildActiveCoreBgPatternWallpapers({
    source,
    type,
    blurIntensity,
    brightness,
    saturation,
  })

  const gradientWallpapers = buildActiveCoreBgGradientWallpapers({ source, type, gradient })

  const wallpapers = { ...gradientWallpapers, ...patternWallpapers }
  const activeGradient = getActiveCoreBgGradientRecipe(config)
  if (type === WALLPAPER_TYPE.GRADIENT && activeGradient) {
    const parsed = parseCoreBgGradientRecipe(activeGradient, {
      hasPattern,
      patternId,
      blurIntensity,
      brightness,
      saturation,
    })
    return {
      source,
      ...parsed,
    }
  }

  const parsed = parseCoreBgWallpaper(wallpapers, source, customWallpaper)

  return {
    source,
    ...parsed,
  }
}

/**
 * Resolves a CoreBg config to the full renderer render spec.
 *
 * This is the canonical bridge from model to rendering/export. Runtime renderers,
 * previews, and frontend static export should all consume this render spec rather
 * than re-implementing gradient, pattern, texture, or image logic.
 *
 * Pass `fallbackConfig` when the renderer needs a CSS fallback that differs from
 * the WebGL layer, such as stripping pattern from the fallback while rendering
 * pattern as a separate overlay.
 *
 * @example
 * const renderSpec = resolveCoreBgRenderSpec(bg, fallbackBg)
 * return <CoreBgRenderer renderSpec={renderSpec} />
 */
export const resolveCoreBgRenderSpec = (
  config: TCoreBgConfig,
  fallbackConfig: TCoreBgConfig = config,
): TCoreBgRenderSpec => {
  const { background, effect } = resolveCoreBg(fallbackConfig)
  const base = {
    background: background || 'transparent',
    filter: getFilterValue(effect),
    hasPattern: false,
    patternImage: resolveCoreBgPattern(config.patternId),
    patternOpacity: getPatternOpacity(config.patternIntensity),
    patternColor: getPatternColor(config.patternTone),
    hasTexture: config.hasTexture,
    source: config.source,
    bgSize: config.bgSize,
    colors: DEFAULT_RENDER_COLORS,
    colorStops: normalizeEvenGradientStops(DEFAULT_RENDER_COLORS.length),
    flow: config.gradient?.renderer === GRADIENT_RENDERER.LINEAR ? config.gradient.angle : 180,
    texture: normalizeTexture(config.texture),
    blurIntensity: config.blurIntensity,
    brightness: config.brightness,
    saturation: config.saturation,
    gradientRecipe: null,
    meshRecipe: null,
    imageUrl: '',
  }

  if (config.type === WALLPAPER_TYPE.NONE) {
    return { ...base, kind: CORE_BG_RENDER_KIND.NONE }
  }

  if (config.type === WALLPAPER_TYPE.GRADIENT) {
    const gradient = getActiveCoreBgGradientRecipe(config)
    if (!gradient) return { ...base, kind: CORE_BG_RENDER_KIND.NONE }

    if (isMeshGradientRecipe(gradient)) {
      const meshRecipe = normalizeMeshRecipe(gradient)
      return {
        ...base,
        kind: CORE_BG_RENDER_KIND.MESH_GRADIENT,
        hasPattern: config.hasPattern,
        patternImage: resolveCoreBgPattern(config.patternId),
        patternOpacity: getPatternOpacity(config.patternIntensity),
        patternColor: getPatternColor(config.patternTone),
        hasTexture: config.hasTexture,
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
          ? CORE_BG_RENDER_KIND.RADIAL_GRADIENT
          : CORE_BG_RENDER_KIND.LINEAR_GRADIENT,
      hasPattern: config.hasPattern,
      patternImage: resolveCoreBgPattern(config.patternId),
      patternOpacity: getPatternOpacity(config.patternIntensity),
      patternColor: getPatternColor(config.patternTone),
      hasTexture: config.hasTexture,
      colors: gradient.colors,
      colorStops: normalizeGradientStops(gradient),
      flow: gradient.renderer === GRADIENT_RENDERER.LINEAR ? gradient.angle : 180,
      gradientRecipe: gradient,
    }
  }

  if (!config.source) {
    return { ...base, kind: CORE_BG_RENDER_KIND.NONE }
  }

  if (config.type === WALLPAPER_TYPE.PATTERN) {
    const wallpaper = buildActiveCoreBgPatternWallpapers(config)[config.source] as
      | TWallpaperPic
      | undefined

    return {
      ...base,
      kind: wallpaper?.image ? CORE_BG_RENDER_KIND.IMAGE : CORE_BG_RENDER_KIND.NONE,
      imageUrl: wallpaper?.image || '',
    }
  }

  if (config.type === WALLPAPER_TYPE.UPLOAD) {
    return {
      ...base,
      kind: config.source ? CORE_BG_RENDER_KIND.IMAGE : CORE_BG_RENDER_KIND.NONE,
      imageUrl: config.source,
    }
  }

  return { ...base, kind: CORE_BG_RENDER_KIND.NONE }
}
