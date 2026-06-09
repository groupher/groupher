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

import { buildActiveBgGradientWallpapers, buildActiveBgPatternWallpapers } from './catalog'
import { BG_RENDER_TYPE } from './constant'
import { parseBgGradientRecipe, parseBgWallpaper, resolveBgPattern } from './parse'
import type { TBgConfig, TBgRenderSpec } from './spec'

type TResolvedBg = { source: string } & TWallpaperFmt

const DEFAULT_RENDER_COLORS = ['#fbeede', '#d8b9e3']

const getFilterValue = (effect: string): string =>
  effect.replace(/^filter:\s*/, '').trim() || 'none'

const getPatternOpacity = (patternIntensity: number): number =>
  Math.max(0, Math.min(100, patternIntensity)) / 100

const getPatternColor = (patternTone: TWallpaperThemeState['patternTone']): string =>
  patternTone === WALLPAPER_PATTERN_TONE.LIGHT ? '#ffffff' : '#000000'

const getActiveBgGradientRecipe = (config: TBgConfig): TGradientRecipe | null => {
  const gradientWallpapers = buildActiveBgGradientWallpapers({
    source: config.source,
    type: config.type,
    gradient: config.gradient,
  })

  return config.gradient || gradientWallpapers[config.source] || null
}

/**
 * Maps the current Wallpaper store shape into the common single-theme Bg shape.
 *
 * This is a compatibility adapter while Wallpaper still persists flat light/dark
 * fields. New consumers should prefer constructing `TBgConfig` directly.
 *
 * @example
 * const bg = toBgConfig(resolveWallpaperThemeState(store, isDarkTheme))
 */
export const toBgConfig = (store: Pick<TStore, keyof TWallpaperThemeState>): TBgConfig => ({
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
 * Maps store state to the CSS fallback-only Bg config.
 *
 * Wallpaper's CSS hook intentionally ignores WebGL texture because the texture is
 * rendered by `BgRenderer`, while CSS fallback only needs background/filter.
 *
 * @example
 * const cssBg = resolveBg(toBgCssConfig(wallpaperState))
 */
export const toBgCssConfig = (store: Pick<TStore, keyof TWallpaperThemeState>): TBgConfig => ({
  ...toBgConfig(store),
  texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
})

/**
 * Resolves a Bg config to CSS-compatible background and filter strings.
 *
 * Use this for non-WebGL fallbacks and simple CSS consumers. Components that need
 * texture, mesh, or pattern overlay should use `resolveBgRenderSpec`.
 *
 * @example
 * const { background, effect } = resolveBg(bg)
 */
export const resolveBg = (config: TBgConfig): TResolvedBg => {
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

  const patternWallpapers = buildActiveBgPatternWallpapers({
    source,
    type,
    blurIntensity,
    brightness,
    saturation,
  })

  const gradientWallpapers = buildActiveBgGradientWallpapers({ source, type, gradient })

  const wallpapers = { ...gradientWallpapers, ...patternWallpapers }
  const activeGradient = getActiveBgGradientRecipe(config)
  if (type === WALLPAPER_TYPE.GRADIENT && activeGradient) {
    const parsed = parseBgGradientRecipe(activeGradient, {
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

  const parsed = parseBgWallpaper(wallpapers, source, customWallpaper)

  return {
    source,
    ...parsed,
  }
}

/**
 * Resolves a Bg config to the full renderer render spec.
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
 * const renderSpec = resolveBgRenderSpec(bg, fallbackBg)
 * return <BgRenderer renderSpec={renderSpec} />
 */
export const resolveBgRenderSpec = (
  config: TBgConfig,
  fallbackConfig: TBgConfig = config,
): TBgRenderSpec => {
  const { background, effect } = resolveBg(fallbackConfig)
  const base = {
    background: background || 'transparent',
    filter: getFilterValue(effect),
    hasPattern: false,
    patternImage: resolveBgPattern(config.patternId),
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
    return { ...base, type: BG_RENDER_TYPE.NONE }
  }

  if (config.type === WALLPAPER_TYPE.GRADIENT) {
    const gradient = getActiveBgGradientRecipe(config)
    if (!gradient) return { ...base, type: BG_RENDER_TYPE.NONE }

    if (isMeshGradientRecipe(gradient)) {
      const meshRecipe = normalizeMeshRecipe(gradient)
      return {
        ...base,
        type: BG_RENDER_TYPE.MESH_GRADIENT,
        hasPattern: config.hasPattern,
        patternImage: resolveBgPattern(config.patternId),
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
      type:
        gradient.renderer === GRADIENT_RENDERER.RADIAL
          ? BG_RENDER_TYPE.RADIAL_GRADIENT
          : BG_RENDER_TYPE.LINEAR_GRADIENT,
      hasPattern: config.hasPattern,
      patternImage: resolveBgPattern(config.patternId),
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
    return { ...base, type: BG_RENDER_TYPE.NONE }
  }

  if (config.type === WALLPAPER_TYPE.PATTERN) {
    const wallpaper = buildActiveBgPatternWallpapers(config)[config.source] as
      | TWallpaperPic
      | undefined

    return {
      ...base,
      type: wallpaper?.image ? BG_RENDER_TYPE.IMAGE : BG_RENDER_TYPE.NONE,
      imageUrl: wallpaper?.image || '',
    }
  }

  if (config.type === WALLPAPER_TYPE.UPLOAD) {
    return {
      ...base,
      type: config.source ? BG_RENDER_TYPE.IMAGE : BG_RENDER_TYPE.NONE,
      imageUrl: config.source,
    }
  }

  return { ...base, type: BG_RENDER_TYPE.NONE }
}
