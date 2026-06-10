import { clone } from 'ramda'

import {
  GRADIENT_PALETTE,
  GRADIENT_WALLPAPER,
  PATTERN_WALLPAPER,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import type { TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TGradientPalette, TWallpaper, TWallpaperPic, TWallpaperType } from '~/spec'

/**
 * Wallpaper rendering needs mutable per-session state (active recipe edits, selected
 * picture filters), but the raw source objects in `~/const/wallpaper` must stay static
 * and shared.
 *
 * This module produces isolated, clone-based asset views used by compose/adapters:
 * - it prevents accidental mutation of module-level defaults;
 * - it applies "active item" overrides (for preview/editing only);
 * - it keeps all editors and renderers reading from the same consistent input shape.
 *
 * Without this copier layer, interactive edits to one preview can leak into global
 * wallpaper constants and affect other tabs/components.
 *
 * @example
 * const gradientWallpapers = composeBgGradientAssetWallpapers()
 */

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
 * Returns the shared gradient recipe catalog for Bg selection UIs.
 *
 * @example
 * const gradients = composeBgGradientAssetWallpapers()
 */
export const composeBgGradientAssetWallpapers = (): Record<string, TGradientRecipe> =>
  clone(GRADIENT_WALLPAPER)

/**
 * Returns the shared gradient palette catalog for swatch grids.
 *
 * @example
 * const palettes = composeBgGradientPaletteWallpapers()
 */
export const composeBgGradientPaletteWallpapers = (): Record<string, TGradientPalette> =>
  clone(GRADIENT_PALETTE)

/**
 * Returns the shared picture catalog for Bg picture mode.
 *
 * Items are normalized to no blur so editor-specific blur/brightness/saturation are
 * only applied to the active selection.
 *
 * @example
 * const pictures = composeBgPictureAssetWallpapers()
 */
export const composeBgPictureAssetWallpapers = (
  catalog: Record<string, TWallpaper> = PATTERN_WALLPAPER,
): Record<string, TWallpaper> => {
  const wallpapers = clone(catalog)

  for (const wallpaper of Object.values(wallpapers) as TWallpaperPic[]) {
    wallpaper.blurIntensity = 0
  }

  return wallpapers
}

/**
 * Compose the default shared picture catalog for Bg picture mode.
 *
 * @example
 * const pictures = composeBgPatternAssetWallpapers()
 */
export const composeBgPatternAssetWallpapers = (): Record<string, TWallpaper> =>
  composeBgPictureAssetWallpapers()

/**
 * Returns gradient catalog data with the active custom recipe patched in.
 *
 * Use this when rendering a grid where a selected preset may have edited colors,
 * spread, renderer, or angle.
 *
 * @example
 * const wallpapers = composeActiveBgGradientWallpapers({ source, type, gradient })
 */
export const composeActiveBgGradientWallpapers = (
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
 * const wallpapers = composeActiveBgPatternWallpapers({
 *   source,
 *   type,
 *   blurIntensity,
 *   brightness,
 *   saturation,
 * })
 */
export const composeActiveBgPatternWallpapers = (
  state: TPatternEffectState,
  catalog: Record<string, TWallpaper> = PATTERN_WALLPAPER,
): Record<string, TWallpaper> => {
  const wallpapers = clone(catalog)

  if (state.type !== WALLPAPER_TYPE.PATTERN) return wallpapers

  const activeWallpaper = wallpapers[state.source] as TWallpaperPic | undefined
  if (!activeWallpaper) return wallpapers

  activeWallpaper.blurIntensity = state.blurIntensity
  activeWallpaper.brightness = state.brightness
  activeWallpaper.saturation = state.saturation

  return wallpapers
}
