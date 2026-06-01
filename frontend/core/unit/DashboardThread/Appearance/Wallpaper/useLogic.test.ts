import { GRADIENT_WALLPAPER, GRADIENT_WALLPAPER_NAME, WALLPAPER_TYPE } from '~/const/wallpaper'
import {
  buildGradientRecipeForRenderer,
  getGradientRecipeSpread,
  GRADIENT_RENDERER,
} from '~/lib/wallpaperMesh'

import { buildGradientWallpaperPatch } from './useLogic'

describe('buildGradientWallpaperPatch', () => {
  it('defaults to linear when switching from picture to gradient', () => {
    const previousGradient = buildGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.VIOLET_TEAL_AMBER],
      GRADIENT_RENDERER.LIQUID,
    )

    const patch = buildGradientWallpaperPatch(
      { type: WALLPAPER_TYPE.PATTERN, gradient: previousGradient },
      GRADIENT_WALLPAPER_NAME.STONE_GREEN,
    )

    expect(patch.type).toBe(WALLPAPER_TYPE.GRADIENT)
    expect(patch.source).toBe(GRADIENT_WALLPAPER_NAME.STONE_GREEN)
    expect(patch.gradient?.renderer).toBe(GRADIENT_RENDERER.LINEAR)
  })

  it('keeps the active renderer when switching presets inside gradient mode', () => {
    const previousGradient = buildGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.VIOLET_TEAL_AMBER],
      GRADIENT_RENDERER.LIQUID,
    )

    const patch = buildGradientWallpaperPatch(
      { type: WALLPAPER_TYPE.GRADIENT, gradient: previousGradient },
      GRADIENT_WALLPAPER_NAME.STONE_GREEN,
    )

    expect(patch.gradient?.renderer).toBe(GRADIENT_RENDERER.LIQUID)
    expect(patch.gradient?.angle).toBe(previousGradient.angle)
    expect(patch.gradient && getGradientRecipeSpread(patch.gradient)).toBe(
      getGradientRecipeSpread(previousGradient),
    )
    expect(patch.gradient?.colors).toEqual(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN].colors,
    )
  })

  it('keeps the original gradient shape after switching away and back', () => {
    const originalGradient = GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.AMBER_MAUVE]
    const awayPatch = buildGradientWallpaperPatch(
      { type: WALLPAPER_TYPE.GRADIENT, gradient: originalGradient },
      GRADIENT_WALLPAPER_NAME.STONE_GREEN,
    )
    const backPatch = buildGradientWallpaperPatch(
      { type: WALLPAPER_TYPE.GRADIENT, gradient: awayPatch.gradient },
      GRADIENT_WALLPAPER_NAME.AMBER_MAUVE,
    )

    expect(backPatch.gradient).toStrictEqual(originalGradient)
    expect(backPatch.gradient).not.toHaveProperty('stops')
  })
})
