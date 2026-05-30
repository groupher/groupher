import { COLOR, RAINBOW_COLOR_HEX } from '~/const/colors'
import { GRADIENT_TYPE, type TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TColorName } from '~/spec'

export const findPresetColor = (
  color: string,
  theme: keyof typeof RAINBOW_COLOR_HEX,
): TColorName => {
  const match = Object.entries(RAINBOW_COLOR_HEX[theme]).find(([, value]) => value === color)

  return (match?.[0] as TColorName | undefined) ?? COLOR.CUSTOM
}

export const resolvePresetColor = (
  color: TColorName,
  theme: keyof typeof RAINBOW_COLOR_HEX,
): string => RAINBOW_COLOR_HEX[theme][color] ?? RAINBOW_COLOR_HEX[theme][COLOR.BLACK]

export const buildColorChips = (
  gradient: TGradientRecipe,
): Array<{ color: string; index: number; key: string }> => {
  const colorCounts = new Map<string, number>()

  return gradient.colors.map((color, index) => {
    const count = (colorCounts.get(color) ?? 0) + 1
    colorCounts.set(color, count)

    return {
      color,
      index,
      key: `${gradient.preset}-${color}-${count}`,
    }
  })
}

export const getGradientSpreadValue = (gradient: TGradientRecipe): number =>
  gradient.kind === GRADIENT_TYPE.MESH ? gradient.softness : gradient.spread

export const applyGradientSpreadValue = (
  gradient: TGradientRecipe,
  spread: number,
): TGradientRecipe => {
  if (gradient.kind === GRADIENT_TYPE.MESH) {
    // Mesh models share the user-facing Spread control, but each renderer may
    // interpret softness differently. FLOW maps it to strand density/curvature.
    return {
      ...gradient,
      softness: spread,
    }
  }

  return { ...gradient, spread }
}
