import { isEmpty } from 'ramda'

import {
  DEFAULT_WALLPAPER_PATTERN_ID,
  WALLPAPER_BG_SIZE,
  WALLPAPER_PATTERN,
} from '~/const/wallpaper'
import { buildGradientBackground, type TGradientRecipe } from '~/lib/wallpaperMesh'
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

const buildFilterEffect = ({
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

  // Legacy cover gradients still arrive as `TWallpaperGradient` entries until
  // CoverEditor moves to `TGradientRecipe`; keep this branch as the compatibility
  // bridge for the old catalog shape.
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
  const background = buildGradientBackground(gradient)
  const effect = buildFilterEffect({ blurIntensity, brightness, saturation })

  return {
    effect,
    background: hasPattern && patternPic ? `url(${patternPic}) repeat, ${background}` : background,
  }
}

const parseBgGradientBackground = (gradient: TWallpaperGradient): TWallpaperFmt => {
  const DIR = '/wallpaper'
  const { direction, hasPattern, blurIntensity, brightness, saturation } = gradient
  const colors = gradient.colors.join(',')
  let background = `linear-gradient(${formatGradientDirection(direction)}, ${colors})`

  const patternPic = `${DIR}/pattern/${DEFAULT_WALLPAPER_PATTERN_ID}.png`
  background = hasPattern ? `url(${patternPic}) repeat, ${background}` : background

  const effect = buildFilterEffect({ blurIntensity, brightness, saturation })

  return {
    effect,
    background,
  }
}

const formatGradientDirection = (direction = '180deg'): string => {
  const direction$ = direction.trim()

  if (!direction$) return '180deg'
  if (direction$.endsWith('deg')) return direction$
  if (direction$.startsWith('to ')) return direction$

  return `to ${direction$}`
}

const parseBgPicBackground = (pic: TWallpaperPic): TWallpaperFmt => {
  if (!pic) {
    return {
      effect: '',
      background: '',
    }
  }

  const { image, bgSize = WALLPAPER_BG_SIZE.COVER, blurIntensity, brightness, saturation } = pic
  const background = `url(${image}) center / ${bgSize} no-repeat`

  const filter = buildFilterEffect({ blurIntensity, brightness, saturation })

  return {
    effect: filter,
    background,
  }
}
