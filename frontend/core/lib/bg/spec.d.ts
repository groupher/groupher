import type { TGradientRecipe, TMeshGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type {
  TCustomWallpaper,
  TWallpaperBgSize,
  TWallpaperPatternTone,
  TWallpaperType,
} from '~/spec'

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
 *   bgSize: WALLPAPER_BG_SIZE.COVER,
 *   brightness: 100,
 *   saturation: 100,
 *   blurIntensity: 0,
 *   hasPattern: true,
 *   patternId: DEFAULT_WALLPAPER_PATTERN_ID,
 *   patternIntensity: 50,
 *   patternTone: WALLPAPER_PATTERN_TONE.DARK,
 *   hasTexture: false,
 *   texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
 * }
 */
export type TBgConfig = {
  customWallpaper: TCustomWallpaper
  source: string
  type: TWallpaperType

  hasPattern: boolean
  patternId: string
  patternIntensity: number
  patternTone: TWallpaperPatternTone

  hasTexture: boolean
  gradient: TGradientRecipe | null
  blurIntensity: number
  brightness: number
  saturation: number
  texture: TWallpaperTexture

  bgSize: TWallpaperBgSize
}

/**
 * Light/dark wrapper for modules that support theme-specific backgrounds.
 *
 * Keep theme pairing here instead of leaking flat persistence fields such as
 * `sourceDark` into common UI and renderer code. Wallpaper/Cover adapters can
 * serialize this shape to their own API fields.
 *
 * @example
 * const current = theme === THEME.DARK ? themeBg.dark : themeBg.light
 */
export type TBgThemeConfig = {
  light: TBgConfig
  dark: TBgConfig
}

export type TBgRenderKind = BG_RENDER_TYPE

/**
 * Renderer-ready description of a core background.
 *
 * `BgRenderer` and the future frontend export path should consume this same
 * render spec so runtime preview and static image export cannot drift apart.
 *
 * @example
 * const renderSpec = resolveBgRenderSpec(bg)
 * return <BgRenderer renderSpec={renderSpec} />
 */
export type TBgRenderSpec = {
  kind: TBgRenderKind
  background: string
  filter: string
  hasPattern: boolean
  patternImage: string
  patternOpacity: number
  patternColor: string
  hasTexture: boolean
  source: string
  bgSize: TWallpaperBgSize
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
