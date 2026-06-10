import { isEmpty } from 'ramda'

import { DEFAULT_WALLPAPER_PATTERN_ID, WALLPAPER_PATTERN } from '~/const/wallpaper'
import { composeGradientBackground, type TGradientRecipe } from '~/lib/wallpaperMesh'
import type {
  TCustomWallpaper,
  TWallpaper,
  TWallpaperFmt,
  TWallpaperGradient,
  TWallpaperPic,
} from '~/spec'

const DEFAULT_BRIGHTNESS = 100
const DEFAULT_SATURATION = 100
const MAX_BLUR_PX = 6

/**
 * Resolves the shared Bg pattern asset for CSS masks and CSS fallbacks.
 *
 * Wallpaper and CoverEditor may expose different UI affordances, but their
 * pattern IDs resolve through the same catalog so preview, runtime rendering,
 * and export can point at the same bitmap asset.
 *
 * @example
 * const patternImage = resolveBgPattern('unicorn')
 */
export const resolveBgPattern = (patternId?: string): string => {
  const pattern = WALLPAPER_PATTERN[patternId || DEFAULT_WALLPAPER_PATTERN_ID]

  return pattern?.image || WALLPAPER_PATTERN[DEFAULT_WALLPAPER_PATTERN_ID]?.image || ''
}

/**
 * Compose the CSS filter declaration for a Bg fallback background.
 *
 * @example
 * const effect = composeFilterEffect({ blurIntensity: 30, brightness: 90 })
 */
const composeFilterEffect = ({
  blurIntensity = 0,
  brightness = DEFAULT_BRIGHTNESS,
  saturation = DEFAULT_SATURATION,
}: {
  blurIntensity?: number
  brightness?: number
  saturation?: number
}): string => {
  const filters = []
  const safeBlurIntensity = Math.max(0, Math.min(100, blurIntensity))

  if (safeBlurIntensity > 0) {
    filters.push(`blur(${Number(((safeBlurIntensity / 100) * MAX_BLUR_PX).toFixed(1))}px)`)
  }
  if (brightness !== DEFAULT_BRIGHTNESS) filters.push(`brightness(${brightness}%)`)
  if (saturation !== DEFAULT_SATURATION) filters.push(`saturate(${saturation}%)`)

  return filters.length ? `filter: ${filters.join(' ')}` : ''
}

/**
 * Parses a Bg source catalog entry or custom value into CSS fallback output.
 *
 * The fallback string is intentionally limited to CSS-compatible effects. WebGL
 * texture, mesh, and export paths consume `TBgRenderSpec` instead of this
 * CSS-only shape.
 *
 * @example
 * const css = parseBgWallpaper(wallpapers, source, customWallpaper)
 */
export const parseBgWallpaper = (
  wallpapers: Record<string, TWallpaper | TGradientRecipe>,
  name: string,
  customWallpaper?: TCustomWallpaper,
): TWallpaperFmt => {
  if (customWallpaper) return parseResolvedBgWallpaper(wallpapers[name], customWallpaper)

  if (isEmpty(name)) {
    return {
      effect: '',
      background: '',
    }
  }

  return parseResolvedBgWallpaper(wallpapers[name], customWallpaper)
}

const parseResolvedBgWallpaper = (
  wallpaper: TWallpaper | TGradientRecipe,
  customWallpaper?: TCustomWallpaper,
): TWallpaperFmt => {
  if (customWallpaper) {
    return 'colors' in customWallpaper
      ? parseBgGradientBackground(customWallpaper)
      : parseBgPicBackground(customWallpaper)
  }
  if (wallpaper && 'renderer' in wallpaper) return parseBgGradientRecipe(wallpaper)

  // Custom wallpaper payloads may still use the legacy CSS-gradient shape.
  // Catalog gradients should use `TGradientRecipe`.
  return wallpaper && 'colors' in wallpaper
    ? parseBgGradientBackground(wallpaper as TWallpaperGradient)
    : parseBgPicBackground(wallpaper as TWallpaperPic)
}

/**
 * Converts a gradient recipe into the CSS fallback background string.
 *
 * Renderer code uses the same recipe object in `TBgRenderSpec`, while this
 * helper provides the CSS fallback used before WebGL paints or when WebGL is not
 * available.
 *
 * @example
 * const { background } = parseBgGradientRecipe(recipe, { hasPattern: true })
 */
export const parseBgGradientRecipe = (
  gradient: TGradientRecipe,
  {
    hasPattern = false,
    patternId = DEFAULT_WALLPAPER_PATTERN_ID,
    blurIntensity = 0,
    brightness = DEFAULT_BRIGHTNESS,
    saturation = DEFAULT_SATURATION,
  }: {
    hasPattern?: boolean
    patternId?: string
    blurIntensity?: number
    brightness?: number
    saturation?: number
  } = {},
): TWallpaperFmt => {
  const patternPic = resolveBgPattern(patternId)
  const background = composeGradientBackground(gradient)
  const effect = composeFilterEffect({ blurIntensity, brightness, saturation })

  return {
    effect,
    background: hasPattern && patternPic ? `url(${patternPic}) repeat, ${background}` : background,
  }
}

/**
 * Parse legacy gradient wallpaper payloads into CSS fallback output.
 *
 * @example
 * const css = parseBgGradientBackground({
 *   direction: 'to right',
 *   colors: ['#fff', '#000'],
 *   hasPattern: false,
 *   blurIntensity: 12,
 *   brightness: 90,
 *   saturation: 110,
 * })
 */
const parseBgGradientBackground = (gradient: TWallpaperGradient): TWallpaperFmt => {
  const DIR = '/wallpaper'
  const { direction, hasPattern, blurIntensity, brightness, saturation } = gradient
  const colors = gradient.colors.join(',')
  let background = `linear-gradient(${formatGradientDirection(direction)}, ${colors})`

  const patternPic = `${DIR}/pattern/${DEFAULT_WALLPAPER_PATTERN_ID}.png`
  background = hasPattern ? `url(${patternPic}) repeat, ${background}` : background

  const effect = composeFilterEffect({ blurIntensity, brightness, saturation })

  return {
    effect,
    background,
  }
}

/**
 * Normalize gradient direction to browser-compatible syntax.
 *
 * @example
 * formatGradientDirection('top right') // "to top right"
 */
const formatGradientDirection = (direction = '180deg'): string => {
  const direction$ = direction.trim()

  if (!direction$) return '180deg'
  if (direction$.endsWith('deg')) return direction$
  if (direction$.startsWith('to ')) return direction$

  return `to ${direction$}`
}

/**
 * Parse picture wallpaper payload into CSS fallback output.
 *
 * @example
 * const css = parseBgPicBackground({ image: '/cover.webp', blurIntensity: 10 })
 */
const parseBgPicBackground = (pic: TWallpaperPic): TWallpaperFmt => {
  if (!pic) {
    return {
      effect: '',
      background: '',
    }
  }

  const { image, blurIntensity, brightness, saturation } = pic
  const background = `url(${image}) center / cover no-repeat`

  const filter = composeFilterEffect({ blurIntensity, brightness, saturation })

  return {
    effect: filter,
    background,
  }
}
