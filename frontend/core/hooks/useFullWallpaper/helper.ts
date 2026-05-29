import { clone } from 'ramda'

import { GRADIENT_WALLPAPER, PATTERN_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TWallpaper, TWallpaperPic, TWallpaperType } from '~/spec'

type TGradientEffectState = {
  source: string
  type: TWallpaperType
  gradient: TGradientRecipe | null
}

type TPatternEffectState = {
  source: string
  type: TWallpaperType
  blurIntensity: number
  brightness: number
  saturation: number
}

export const buildGradientCatalogWallpapers = (): Record<string, TGradientRecipe> =>
  clone(GRADIENT_WALLPAPER)

export const buildPatternCatalogWallpapers = (): Record<string, TWallpaper> => {
  const wallpapers = clone(PATTERN_WALLPAPER)

  for (const wallpaper of Object.values(wallpapers) as TWallpaperPic[]) {
    wallpaper.blurIntensity = 0
  }

  return wallpapers
}

export const buildActiveGradientWallpapers = (
  state: TGradientEffectState,
): Record<string, TGradientRecipe> => {
  const wallpapers = clone(GRADIENT_WALLPAPER)

  if (state.type !== WALLPAPER_TYPE.GRADIENT) return wallpapers

  if (state.gradient) wallpapers[state.source] = clone(state.gradient)

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
