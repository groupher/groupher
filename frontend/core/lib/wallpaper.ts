import { isEmpty } from 'ramda'

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
 * parse wallpaper both for gradient and picture background
 */
export const parseWallpaper = (
  wallpapers: Record<string, TWallpaper>,
  name: string,
  customWallpaper?: TCustomWallpaper,
): TWallpaperFmt => {
  if (customWallpaper) return _parseWallpaper(wallpapers[name], customWallpaper)

  if (isEmpty(name)) {
    return {
      effect: '',
      background: '',
    }
  }

  return _parseWallpaper(wallpapers[name], customWallpaper)
}
/**
 * parse wallpaper both for gradient and picture background
 */
const _parseWallpaper = (
  wallpaper: TWallpaper,
  customWallpaper?: TCustomWallpaper,
): TWallpaperFmt => {
  if (customWallpaper) {
    return 'colors' in customWallpaper
      ? _parseGradientBackground(customWallpaper)
      : _parsePicBackground(customWallpaper)
  }
  // @ts-expect-error
  return wallpaper?.colors ? _parseGradientBackground(wallpaper) : _parsePicBackground(wallpaper)
}

const _parseGradientBackground = (gradient: TWallpaperGradient): TWallpaperFmt => {
  const DIR = '/wallpaper'
  const { direction, hasPattern, blurIntensity, brightness, saturation } = gradient
  const colors = gradient.colors.join(',')
  let background = `linear-gradient(${formatGradientDirection(direction)}, ${colors})`

  const patternPic = `${DIR}/pattern/1.png`
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

const _parsePicBackground = (pic: TWallpaperPic): TWallpaperFmt => {
  if (!pic) {
    // for BLANK background settings
    return {
      effect: '',
      background: '',
    }
  }

  const { image, bgSize = 'cover', blurIntensity, brightness, saturation } = pic
  const background = `url(${image}) center / ${bgSize} no-repeat`

  const filter = buildFilterEffect({ blurIntensity, brightness, saturation })

  return {
    effect: filter,
    background,
  }
}
