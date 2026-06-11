import type { TGradientRecipe, TMeshGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TCustomWallpaper, TWallpaper, TWallpaperPatternTone, TWallpaperType } from '~/spec'

import type { BG_RENDER_TYPE } from './constant'

/**
 * Single-theme core background config.
 *
 * This is the common model shared by Wallpaper and CoverEditor. It intentionally
 * excludes module-specific fields such as Wallpaper content shadow and Cover image
 * transform/frame/magnifier settings.
 *
 * @example
 * const bg: TBgConfig = {
 *   type: WALLPAPER_TYPE.GRADIENT,
 *   source: 'amber_mauve',
 *   gradient: GRADIENT_WALLPAPER.amber_mauve,
 *   customWallpaper: null,
 *   effect: { brightness: 100, saturation: 100, blurIntensity: 0 },
 *   pattern: {
 *     enabled: true,
 *     id: DEFAULT_WALLPAPER_PATTERN_ID,
 *     intensity: 50,
 *     tone: WALLPAPER_PATTERN_TONE.DARK,
 *   },
 *   texture: { enabled: false, type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
 * }
 */
export type TBgPattern = {
  enabled: boolean
  id: string
  intensity: number
  tone: TWallpaperPatternTone
}

export type TBgEffect = {
  blurIntensity: number
  brightness: number
  saturation: number
}

export type TBgTexture = TWallpaperTexture & {
  enabled: boolean
}

export type TBgConfig = {
  customWallpaper: TCustomWallpaper
  source: string
  type: TWallpaperType

  pattern: TBgPattern
  gradient: TGradientRecipe | null
  effect: TBgEffect
  texture: TBgTexture
}

export type TBgResolveOptions = {
  /**
   * Optional catalog override for pattern wallpaper resolution.
   *
   * @example
   * composeBgCss(config, { pictureCatalog })
   */
  pictureCatalog?: Record<string, TWallpaper>
}

/**
 * Render-spec resolution options for `composeBgRenderSpec`.
 *
 * @example
 * const spec = composeBgRenderSpec(config, {
 *   pictureCatalog,
 *   fallbackConfig: customFallback,
 * })
 */
export type TBgRenderResolveOptions = TBgResolveOptions & {
  /**
   * Optional fallback config used when renderer-safe defaults are needed.
   */
  fallbackConfig?: TBgConfig
}

/**
 * Light/dark wrapper for modules that support theme-specific backgrounds.
 *
 * Keep theme pairing here instead of leaking persistence concerns into common
 * UI and renderer code.
 *
 * @example
 * const current = theme === THEME.DARK ? themeBg.dark : themeBg.light
 */
export type TBgThemeConfig = {
  light: TBgConfig
  dark: TBgConfig
}

/**
 * Alias for renderer output type to keep render contracts explicit.
 *
 * @example
 * const mode: TBgRenderType = BG_RENDER_TYPE.IMAGE
 */
export type TBgRenderType = BG_RENDER_TYPE

/**
 * Renderer-ready description of a core background.
 *
 * `BgRenderer` and the future frontend export path should consume this same
 * render spec so runtime preview and static image export cannot drift apart.
 *
 * @example
 * const renderSpec = composeBgRenderSpec(bg)
 * return <BgRenderer renderSpec={renderSpec} />
 */
export type TBgRenderSpec = {
  type: TBgRenderType
  background: string
  filter: string
  hasPattern: boolean
  patternImage: string
  patternOpacity: number
  patternColor: string
  hasTexture: boolean
  source: string
  colors: string[]
  colorStops: number[]
  flow: number
  texture: TWallpaperTexture
  blurIntensity: number
  brightness: number
  saturation: number
  gradientRecipe: TGradientRecipe | null
  meshRecipe: TMeshGradientRecipe | null
  imageUrl: string
}
