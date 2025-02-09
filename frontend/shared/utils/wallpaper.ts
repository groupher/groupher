import { isEmpty } from 'ramda'

import type {
  TWallpaperFmt,
  TWallpaperGradient,
  TWallpaperPic,
  TWallpaper,
  TCustomWallpaper,
} from '~/spec'

/**
 * parse wallpaper both for gradient and picture background
 */
export const parseWallpaper = (
  wallpapers: Record<string, TWallpaper>,
  name: string,
  customWallpaper?: TCustomWallpaper,
): TWallpaperFmt => {
  if (isEmpty(name)) {
    return {
      effect: '',
      background: '',
    }
  }

  return _parseWallpaper(wallpapers[name], customWallpaper)
}

export const holder = 1
/**
 * parse wallpaper both for gradient and picture background
 */
const _parseWallpaper = (
  wallpaper: TWallpaper,
  customWallpaper?: TCustomWallpaper,
): TWallpaperFmt => {
  if (customWallpaper) {
    return _parseGradientBackground(customWallpaper)
  }
  // @ts-ignore
  return wallpaper?.colors ? _parseGradientBackground(wallpaper) : _parsePicBackground(wallpaper)
}

const _parseGradientBackground = (gradient: TWallpaperGradient): TWallpaperFmt => {
  const DIR = '/wallpaper'
  const { direction, hasPattern, hasBlur } = gradient
  const colors = gradient.colors.join(',')
  // let background = `linear-gradient(to ${direction}, ${colors})`
  let background = `linear-gradient(to ${direction}, ${colors})`

  const patternPic = `${DIR}/patterns/1.png`
  background = hasPattern ? `url(${patternPic}) repeat, ${background}` : background

  const effect = hasBlur ? 'filter: blur(3px)' : ''

  return {
    effect,
    background,
  }
}

const _parsePicBackground = (pic: TWallpaperPic): TWallpaperFmt => {
  if (!pic) {
    // for BLANK background settings
    return {
      effect: '',
      background: '',
    }
  }

  const { bgImage, bgSize = 'contain', hasBlur } = pic
  const background = `url(${bgImage})`

  const blur = hasBlur ? 'filter: blur(3px)' : ''
  const effect = `background-size: ${bgSize} !important; ${blur}`

  return {
    effect,
    background,
  }
}
