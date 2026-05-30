import { GRADIENT_WALLPAPER, GRADIENT_WALLPAPER_NAME, WALLPAPER_TYPE } from '~/const/wallpaper'
import { buildGradientRecipeForRenderer, GRADIENT_RENDERER } from '~/lib/wallpaperMesh'

import { buildGradientWallpaperPatch } from './useLogic'

describe('buildGradientWallpaperPatch', () => {
  it('defaults to linear when switching from picture to gradient', () => {
    const previousGradient = buildGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.AURORA],
      GRADIENT_RENDERER.LIQUID,
    )

    const patch = buildGradientWallpaperPatch(
      { type: WALLPAPER_TYPE.PATTERN, gradient: previousGradient },
      GRADIENT_WALLPAPER_NAME.GREEN,
    )

    expect(patch.type).toBe(WALLPAPER_TYPE.GRADIENT)
    expect(patch.source).toBe(GRADIENT_WALLPAPER_NAME.GREEN)
    expect(patch.gradient?.renderer).toBe(GRADIENT_RENDERER.LINEAR)
  })

  it('keeps the active renderer when switching presets inside gradient mode', () => {
    const previousGradient = buildGradientRecipeForRenderer(
      GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.AURORA],
      GRADIENT_RENDERER.LIQUID,
    )

    const patch = buildGradientWallpaperPatch(
      { type: WALLPAPER_TYPE.GRADIENT, gradient: previousGradient },
      GRADIENT_WALLPAPER_NAME.GREEN,
    )

    expect(patch.gradient?.renderer).toBe(GRADIENT_RENDERER.LIQUID)
  })
})
