import {
  DEFAULT_WALLPAPER_PATTERN_ID,
  PATTERN_WALLPAPER,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import { COVER_GRADIENT_EFFECT, COVER_GRADIENT_WALLPAPER } from '~/constant/cover'
import { composeBgRenderSpec } from '~/lib/bg'
import type { TBgConfig, TBgRenderSpec, TBgThemeConfig } from '~/lib/bg'
import {
  GRADIENT_RENDERER,
  WALLPAPER_TEXTURE,
  composeGradientRecipeForRenderer,
  type TGradientRecipe,
} from '~/lib/wallpaperMesh'
import type { TWallpaperPic } from '~/spec'

export { COVER_GRADIENT_PALETTE } from '~/constant/cover'

const COVER_DEFAULT_GRADIENT = {
  LIGHT: 'pink',
  DARK: 'purple2',
} as const

const COVER_DEFAULT_TEXTURE = {
  type: WALLPAPER_TEXTURE.NOISE,
  intensity: 0,
  params: {},
}

export const COVER_PICTURE_WALLPAPER = PATTERN_WALLPAPER as Record<string, TWallpaperPic>

/**
 * Compose a cover gradient recipe from the cover-only preset catalog.
 *
 * Cover keeps its own palette, but the output is the same `TGradientRecipe`
 * protocol consumed by Wallpaper and `BgRenderer`.
 *
 * @example
 * const recipe = composeCoverGradientRecipe('pink', GRADIENT_RENDERER.RADIAL)
 */
export const composeCoverGradientRecipe = (
  source: string,
  renderer = GRADIENT_RENDERER.LINEAR,
): TGradientRecipe => {
  const key = source in COVER_GRADIENT_WALLPAPER ? source : COVER_DEFAULT_GRADIENT.LIGHT
  const recipe = COVER_GRADIENT_WALLPAPER[key]

  return composeGradientRecipeForRenderer(recipe, renderer)
}

/**
 * Create a single-theme cover Bg config from a cover preset.
 *
 * @example
 * const lightBg = createCoverBgConfig('pink')
 */
export const createCoverBgConfig = (source: string = COVER_DEFAULT_GRADIENT.LIGHT): TBgConfig => {
  const gradient = composeCoverGradientRecipe(source)
  const effect = COVER_GRADIENT_EFFECT[source] ?? {}

  return {
    customWallpaper: null,
    source,
    type: WALLPAPER_TYPE.GRADIENT,
    pattern: {
      enabled: false,
      id: DEFAULT_WALLPAPER_PATTERN_ID,
      intensity: 0,
      // Pattern tone defaults to dark since the default cover config does not enable
      // patterns by default, and it should remain independent from global theme.
      tone: WALLPAPER_PATTERN_TONE.DARK,
    },
    gradient,
    effect: {
      blurIntensity: effect.blurIntensity ?? 0,
      brightness: effect.brightness ?? 100,
      saturation: effect.saturation ?? 100,
    },
    texture: { enabled: false, ...COVER_DEFAULT_TEXTURE },
  }
}

/**
 * Compose a dual-theme default cover background config.
 *
 * @example
 * const coverBg = createCoverBgThemeConfig()
 * // coverBg.light.source === 'pink'
 * // coverBg.dark.source === 'purple2'
 */
export const createCoverBgThemeConfig = (): TBgThemeConfig => ({
  light: createCoverBgConfig(COVER_DEFAULT_GRADIENT.LIGHT),
  dark: createCoverBgConfig(COVER_DEFAULT_GRADIENT.DARK),
})

/**
 * Adapt a cover background config to the shared Bg render spec.
 *
 * The only cover-specific rendering input is its picture catalog; gradient,
 * pattern, texture, and filter composition all stay in `composeBgRenderSpec`.
 *
 * @example
 * const renderSpec = adaptCoverBgRenderSpec(activeBackground)
 */
export const adaptCoverBgRenderSpec = (background: TBgConfig): TBgRenderSpec =>
  composeBgRenderSpec(background, { pictureCatalog: COVER_PICTURE_WALLPAPER })
