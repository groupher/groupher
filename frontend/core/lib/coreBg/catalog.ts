import { clone } from 'ramda'

import {
  GRADIENT_PALETTE,
  GRADIENT_WALLPAPER,
  PATTERN_WALLPAPER,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import type { TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TGradientPalette, TWallpaper, TWallpaperPic, TWallpaperType } from '~/spec'

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

/**
 * Returns the shared gradient recipe catalog for CoreBg selection UIs.
 *
 * The clone lets editors patch the active recipe locally without mutating the
 * source catalog used by other previews or editor sessions.
 *
 * @example
 * const gradients = buildCoreBgGradientCatalogWallpapers()
 */
export const buildCoreBgGradientCatalogWallpapers = (): Record<string, TGradientRecipe> =>
  clone(GRADIENT_WALLPAPER)

/**
 * Returns the shared gradient palette catalog for swatch grids.
 *
 * @example
 * const palettes = buildCoreBgGradientCatalogPalettes()
 */
export const buildCoreBgGradientCatalogPalettes = (): Record<string, TGradientPalette> =>
  clone(GRADIENT_PALETTE)

/**
 * Returns the shared picture catalog for CoreBg picture mode.
 *
 * Catalog items are normalized to no blur so editor-specific blur/brightness/
 * saturation are only applied to the active selection.
 *
 * @example
 * const pictures = buildCoreBgPatternCatalogWallpapers()
 */
export const buildCoreBgPatternCatalogWallpapers = (): Record<string, TWallpaper> => {
  const wallpapers = clone(PATTERN_WALLPAPER)

  for (const wallpaper of Object.values(wallpapers) as TWallpaperPic[]) {
    wallpaper.blurIntensity = 0
  }

  return wallpapers
}

/**
 * Returns gradient catalog data with the active custom recipe patched in.
 *
 * Use this when rendering a grid where a selected preset may have edited colors,
 * spread, renderer, or angle.
 *
 * @example
 * const wallpapers = buildActiveCoreBgGradientWallpapers({ source, type, gradient })
 */
export const buildActiveCoreBgGradientWallpapers = (
  state: TGradientEffectState,
): Record<string, TGradientRecipe> => {
  const wallpapers = clone(GRADIENT_WALLPAPER)

  if (state.type !== WALLPAPER_TYPE.GRADIENT) return wallpapers

  if (state.gradient) wallpapers[state.source] = clone(state.gradient)

  return wallpapers
}

/**
 * Returns picture catalog data with active visual effects applied to the selected item.
 *
 * @example
 * const wallpapers = buildActiveCoreBgPatternWallpapers({
 *   source,
 *   type,
 *   blurIntensity,
 *   brightness,
 *   saturation,
 * })
 */
export const buildActiveCoreBgPatternWallpapers = (
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
