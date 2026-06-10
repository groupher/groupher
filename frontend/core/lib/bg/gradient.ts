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
 *
 * @example
 * const name = findPresetColor('#fbeede', 'light')
 */
export const findPresetColor = (
  color: string,
  theme: keyof typeof RAINBOW_COLOR_HEX,
): TColorName => {
  const match = Object.entries(RAINBOW_COLOR_HEX[theme]).find(([, value]) => value === color)

  return (match?.[0] as TColorName | undefined) ?? COLOR.CUSTOM
}

/**
 * Compose deterministic color chip metadata consumed by color selectors.
 *
 * @example
 * const chips = composeColorChips(recipe)
 */
export const composeColorChips = (
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
 *
 * @example
 * const spread = getGradientSpreadValue(recipe)
 */
export const getGradientSpreadValue = (gradient: TGradientRecipe): number =>
  getGradientRecipeSpread(gradient)

/**
 * Apply user-facing spread control value back to gradient recipe.
 * Mesh gradients store spread-like tuning in `softness`, non-mesh use `spread`.
 *
 * @example
 * const next = applyGradientSpreadValue(recipe, 58)
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
