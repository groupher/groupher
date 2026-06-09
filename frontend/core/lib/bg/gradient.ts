import { COLOR, RAINBOW_COLOR_HEX } from '~/const/colors'
import {
  getGradientRecipeSpread,
  isMeshGradientRecipe,
  type TGradientRecipe,
} from '~/lib/wallpaperMesh'
import type { TColorName } from '~/spec'

/**
 * Resolve which preset color name matches an actual hex string under current theme.
 * Returns COLOR.CUSTOM when no preset color matches.
 */
export const findPresetColor = (
  color: string,
  theme: keyof typeof RAINBOW_COLOR_HEX,
): TColorName => {
  const match = Object.entries(RAINBOW_COLOR_HEX[theme]).find(([, value]) => value === color)

  return (match?.[0] as TColorName | undefined) ?? COLOR.CUSTOM
}

/**
 * Resolve preset color name into hex string for current theme.
 * Falls back to black when the theme palette has no mapping for the name.
 */
export const resolvePresetColor = (
  color: TColorName,
  theme: keyof typeof RAINBOW_COLOR_HEX,
): string => RAINBOW_COLOR_HEX[theme][color] ?? RAINBOW_COLOR_HEX[theme][COLOR.BLACK]

/**
 * Build deterministic color chip metadata consumed by color selectors.
 */
export const buildColorChips = (
  gradient: TGradientRecipe,
): Array<{ color: string; index: number; key: string }> => {
  return gradient.colors.map((color, index) => ({
    color,
    index,
    key: `${gradient.preset}-${index}`,
  }))
}

/**
 * Read user-facing spread value from a gradient recipe.
 * Delegates to renderer-specific logic in wallpaperMesh.
 */
export const getGradientSpreadValue = (gradient: TGradientRecipe): number =>
  getGradientRecipeSpread(gradient)

/**
 * Apply user-facing spread control value back to gradient recipe.
 * Mesh gradients store spread-like tuning in `softness`, non-mesh use `spread`.
 */
export const applyGradientSpreadValue = (
  gradient: TGradientRecipe,
  spread: number,
): TGradientRecipe => {
  if (isMeshGradientRecipe(gradient)) {
    return {
      ...gradient,
      softness: spread,
    }
  }

  return { ...gradient, spread }
}
