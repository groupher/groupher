import { GRADIENT_RENDERER, type TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TGradientEffectInit, TGradientPalette } from '~/spec'

export const COVER_GRADIENT_WALLPAPER_NAME = {
  GREY: 'grey',
  GREY2: 'grey2',
  GREY3: 'grey3',
  PINK: 'pink',
  GREEN: 'green',
  GREEN2: 'green2',
  PURPLE: 'purple',
  PURPLE2: 'purple2',
  PURPLE3: 'purple3',
  YELLOW: 'yellow',
  KANGAROO: 'kangaroo',
  BLUE: 'blue',
  RED: 'red',
  RAINBOX: 'rainbox',
  RAINBOX2: 'rainbox2',
} as const

export const COVER_GRADIENT_PALETTE = {
  grey: {
    key: COVER_GRADIENT_WALLPAPER_NAME.GREY,
    label: 'Grey',
    colors: ['#eef2f3', '#8e9eab'],
  },
  grey2: {
    key: COVER_GRADIENT_WALLPAPER_NAME.GREY2,
    label: 'Grey 2',
    colors: ['#fff', '#abbaab'],
  },
  grey3: {
    key: COVER_GRADIENT_WALLPAPER_NAME.GREY3,
    label: 'Grey 3',
    colors: ['#fff', '#DED9D2'],
  },
  pink: {
    key: COVER_GRADIENT_WALLPAPER_NAME.PINK,
    label: 'Pink',
    colors: ['#E8DADA', '#D4D0D6'],
  },
  green: {
    key: COVER_GRADIENT_WALLPAPER_NAME.GREEN,
    label: 'Green',
    colors: ['#C6D183', '#72B58C'],
  },
  green2: {
    key: COVER_GRADIENT_WALLPAPER_NAME.GREEN2,
    label: 'Green 2',
    colors: ['#00D8BF', '#3B8DC0'],
  },
  purple: {
    key: COVER_GRADIENT_WALLPAPER_NAME.PURPLE,
    label: 'Purple',
    colors: ['#BBA4C9', '#8390CD'],
  },
  purple2: {
    key: COVER_GRADIENT_WALLPAPER_NAME.PURPLE2,
    label: 'Purple 2',
    colors: ['#323455', '#624b77'],
  },
  purple3: {
    key: COVER_GRADIENT_WALLPAPER_NAME.PURPLE3,
    label: 'Purple 3',
    colors: ['#AEB8BE', '#D6A795'],
  },
  yellow: {
    key: COVER_GRADIENT_WALLPAPER_NAME.YELLOW,
    label: 'Yellow',
    colors: ['#F7CE7E', '#E17D43'],
  },
  kangaroo: {
    key: COVER_GRADIENT_WALLPAPER_NAME.KANGAROO,
    label: 'Kangaroo',
    colors: ['#7CB29B', '#EECA95', '#F5EED9'],
  },
  blue: {
    key: COVER_GRADIENT_WALLPAPER_NAME.BLUE,
    label: 'Blue',
    colors: ['#85AADA', '#274AA1'],
  },
  red: {
    key: COVER_GRADIENT_WALLPAPER_NAME.RED,
    label: 'Red',
    colors: ['#FFA69E', '#861657'],
  },
  rainbox: {
    key: COVER_GRADIENT_WALLPAPER_NAME.RAINBOX,
    label: 'Rainbox',
    colors: ['#FF695C', '#A46AAF', '#5A6DEC'],
  },
  rainbox2: {
    key: COVER_GRADIENT_WALLPAPER_NAME.RAINBOX2,
    label: 'Rainbox 2',
    colors: ['#FF987F', '#B4B8F8'],
  },
} satisfies Record<string, TGradientPalette>

const COVER_GRADIENT_EFFECT_INIT: Record<string, TGradientEffectInit> = {
  [COVER_GRADIENT_WALLPAPER_NAME.GREY]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.GREY2]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.GREY3]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.PINK]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.GREEN]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.GREEN2]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.PURPLE]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.PURPLE2]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.PURPLE3]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.YELLOW]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.KANGAROO]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.BLUE]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.RED]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.RAINBOX]: { angle: 180, spread: 58 },
  [COVER_GRADIENT_WALLPAPER_NAME.RAINBOX2]: { angle: 180, spread: 58 },
}

export const COVER_GRADIENT_EFFECT = {} satisfies Record<
  string,
  Partial<Record<'blurIntensity' | 'brightness' | 'saturation', number>>
>

/**
 * Compose a renderer-ready cover gradient recipe from palette metadata.
 *
 * @example
 * const recipe = composeCoverGradientWallpaper(COVER_GRADIENT_PALETTE.pink)
 * // recipe.preset === 'pink'
 */
const composeCoverGradientWallpaper = (palette: TGradientPalette): TGradientRecipe => ({
  version: 2,
  renderer: GRADIENT_RENDERER.LINEAR,
  preset: palette.key,
  colors: palette.colors,
  ...(COVER_GRADIENT_EFFECT_INIT[palette.key] ?? { angle: 180, spread: 58 }),
})

export const COVER_GRADIENT_WALLPAPER = Object.fromEntries(
  Object.values(COVER_GRADIENT_PALETTE).map((palette) => [
    palette.key,
    composeCoverGradientWallpaper(palette),
  ]),
) as Record<string, TGradientRecipe>
