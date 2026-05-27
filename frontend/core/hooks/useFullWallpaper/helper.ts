import { clone } from 'ramda'

import { GRADIENT_WALLPAPER, PATTERN_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import type {
  TWallpaper,
  TWallpaperGradient,
  TWallpaperGradientDir,
  TWallpaperPic,
  TWallpaperType,
} from '~/spec'

type TGradientEffectState = {
  source: string
  type: TWallpaperType
  hasPattern: boolean
  blurIntensity: number
  brightness: number
  saturation: number
  direction: TWallpaperGradientDir
}

type TPatternEffectState = {
  source: string
  type: TWallpaperType
  blurIntensity: number
  brightness: number
  saturation: number
}

export const buildGradientCatalogWallpapers = (): Record<string, TWallpaper> => {
  const wallpapers = clone(GRADIENT_WALLPAPER)

  for (const wallpaper of Object.values(wallpapers) as TWallpaperGradient[]) {
    wallpaper.hasPattern = false
    wallpaper.blurIntensity = 0
    wallpaper.brightness = 100
    wallpaper.saturation = 100
    wallpaper.direction = '180deg'
  }

  return wallpapers
}

export const buildPatternCatalogWallpapers = (): Record<string, TWallpaper> => {
  const wallpapers = clone(PATTERN_WALLPAPER)

  for (const wallpaper of Object.values(wallpapers) as TWallpaperPic[]) {
    wallpaper.blurIntensity = 0
  }

  return wallpapers
}

export const buildActiveGradientWallpapers = (
  state: TGradientEffectState,
): Record<string, TWallpaper> => {
  const wallpapers = clone(GRADIENT_WALLPAPER)

  if (state.type !== WALLPAPER_TYPE.GRADIENT) return wallpapers

  const activeWallpaper = wallpapers[state.source] as TWallpaperGradient | undefined
  if (!activeWallpaper) return wallpapers

  activeWallpaper.hasPattern = state.hasPattern
  activeWallpaper.blurIntensity = state.blurIntensity
  activeWallpaper.brightness = state.brightness
  activeWallpaper.saturation = state.saturation
  activeWallpaper.direction = state.direction

  return wallpapers
}

export const buildActivePatternWallpapers = (
  state: TPatternEffectState,
): Record<string, TWallpaper> => {
  const wallpapers = clone(PATTERN_WALLPAPER)

  if (state.type !== WALLPAPER_TYPE.PATTERN) return wallpapers

  const activeWallpaper = wallpapers[state.source] as TWallpaperPic | undefined
  if (!activeWallpaper) return wallpapers

  activeWallpaper.blurIntensity = state.blurIntensity
  activeWallpaper.brightness = state.brightness
  activeWallpaper.saturation = state.saturation

  return wallpapers
}
