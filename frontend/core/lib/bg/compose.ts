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
import type { TWallpaperThemeState } from '~/stores/wallpaper/spec'

import {
  BG_RENDER_TYPE,
  BG_PATTERN_DARK_COLOR,
  BG_PATTERN_LIGHT_COLOR,
  DEFAULT_RENDER_COLORS,
} from './constant'
import { composeActiveBgGradientWallpapers, composeActiveBgPatternWallpapers } from './copier'
import { parseBgGradientRecipe, parseBgWallpaper, resolveBgPattern } from './css_adapter'
import type { TBgConfig, TBgRenderResolveOptions, TBgRenderSpec, TBgResolveOptions } from './spec'

type TResolvedBg = { source: string } & TWallpaperFmt

/**
 * Extract CSS `filter` token from parse output.
 *
 * @example
 * getFilterValue('filter: blur(2px)') // "blur(2px)"
 */
const getFilterValue = (effect: string): string =>
  effect.replace(/^filter:\s*/, '').trim() || 'none'

/**
 * Convert pattern intensity percent into alpha.
 *
 * @example
 * getPatternOpacity(50) // 0.5
 */
const getPatternOpacity = (patternIntensity: number): number =>
  Math.max(0, Math.min(100, patternIntensity)) / 100

/**
 * Pattern tone is a per-background visual hint, independent from the global theme.
 *
 * It controls how the pattern overlay is rendered on the background:
 * - LIGHT -> white pattern color
 * - DARK  -> black pattern color
 */
const getPatternColor = (patternTone: TWallpaperThemeState['patternTone']): string =>
  patternTone === WALLPAPER_PATTERN_TONE.LIGHT ? BG_PATTERN_LIGHT_COLOR : BG_PATTERN_DARK_COLOR

/**
 * Resolve active gradient recipe from config and active catalog patch.
 *
 * @example
 * const recipe = getActiveBgGradientRecipe(config)
 */
const getActiveBgGradientRecipe = (config: TBgConfig): TGradientRecipe | null => {
  const gradientWallpapers = composeActiveBgGradientWallpapers({
    source: config.source,
    type: config.type,
    gradient: config.gradient,
  })

  return config.gradient || gradientWallpapers[config.source] || null
}

/**
 * Build renderer-safe fallback for gradient + pattern combinations.
 *
 * @example
 * const fallback = getBgRenderFallbackConfig(config)
 */
const getBgRenderFallbackConfig = (config: TBgConfig): TBgConfig =>
  config.type === WALLPAPER_TYPE.GRADIENT && config.hasPattern
    ? { ...config, hasPattern: false }
    : config

/**
 * Maps the current Wallpaper store shape into the common single-theme Bg shape.
 *
 * This is a compatibility adapter while Wallpaper still persists flat light/dark
 * fields. New consumers should prefer constructing `TBgConfig` directly.
 *
 * @example
 * const bg = toBgConfig(pickWallpaperThemeState(store, isDarkTheme))
 */
export const toBgConfig = (store: TWallpaperThemeState): TBgConfig => ({
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
})

/**
 * Maps store state to the CSS fallback-only Bg config.
 *
 * Wallpaper's CSS hook intentionally ignores WebGL texture because the texture is
 * rendered by `BgRenderer`, while CSS fallback only needs background/filter.
 *
 * @example
 * const cssBg = composeBgCss(toBgCssConfig(wallpaperState))
 */
export const toBgCssConfig = (store: TWallpaperThemeState): TBgConfig => ({
  ...toBgConfig(store),
  texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
})

/**
 * Resolves a Bg config to CSS-compatible background and filter strings.
 *
 * Use this for non-WebGL fallbacks and simple CSS consumers. Components that need
 * texture, mesh, or pattern overlay should use `composeBgRenderSpec`.
 *
 * @example
 * const { background, effect } = composeBgCss(bg)
 */
export const composeBgCss = (config: TBgConfig, options: TBgResolveOptions = {}): TResolvedBg => {
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
  } = config
  const { pictureCatalog } = options
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
      blurIntensity,
      brightness,
      saturation,
    }
  }

  const patternWallpapers = composeActiveBgPatternWallpapers(
    {
      source,
      type,
      blurIntensity,
      brightness,
      saturation,
    },
    pictureCatalog,
  )

  const gradientWallpapers = composeActiveBgGradientWallpapers({ source, type, gradient })

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
 * The default fallback is renderer-safe: gradient patterns are stripped from
 * the CSS fallback because `BgRenderer` renders pattern as a separate overlay.
 * Pass `options.fallbackConfig` only for a custom non-renderer fallback.
 *
 * @example
 * const renderSpec = composeBgRenderSpec(bg)
 * return <BgRenderer renderSpec={renderSpec} />
 */
export const composeBgRenderSpec = (
  config: TBgConfig,
  options: TBgRenderResolveOptions = {},
): TBgRenderSpec => {
  const fallbackConfig = options.fallbackConfig ?? getBgRenderFallbackConfig(config)
  const { background, effect } = composeBgCss(fallbackConfig, options)
  const base = {
    background: background || 'transparent',
    filter: getFilterValue(effect),
    hasPattern: false,
    patternImage: resolveBgPattern(config.patternId),
    patternOpacity: getPatternOpacity(config.patternIntensity),
    patternColor: getPatternColor(config.patternTone),
    hasTexture: config.hasTexture,
    source: config.source,
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
    const wallpaper = composeActiveBgPatternWallpapers(config, options.pictureCatalog)[
      config.source
    ] as TWallpaperPic | undefined

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
