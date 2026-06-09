import {
  COVER_GRADIENT_WALLPAPER,
  DEFAULT_WALLPAPER_PATTERN_ID,
  WALLPAPER_BG_SIZE,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import { resolveBgRenderSpec } from '~/lib/bg/resolve'
import type { TBgConfig, TBgRenderSpec, TBgThemeConfig } from '~/lib/bg/spec'
import {
  GRADIENT_RENDERER,
  WALLPAPER_TEXTURE,
  buildGradientRecipeForRenderer,
  type TGradientRecipe,
} from '~/lib/wallpaperMesh'
import type { TGradientPalette, TWallpaperGradient } from '~/spec'
import { getBgRendererFallbackConfig } from '~/widgets/BgRenderer/helper'

const COVER_DEFAULT_GRADIENT = {
  LIGHT: 'pink',
  DARK: 'purple2',
} as const

const COVER_DEFAULT_TEXTURE = {
  type: WALLPAPER_TEXTURE.NOISE,
  intensity: 0,
  params: {},
}

const formatPresetLabel = (key: string): string =>
  key
    .split(/[-_]/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')

const directionToAngle = (direction: string | undefined): number => {
  switch (direction) {
    case 'top':
      return 0
    case 'top right':
      return 45
    case 'right':
      return 90
    case 'bottom right':
      return 135
    case 'bottom':
      return 180
    case 'bottom left':
      return 225
    case 'left':
      return 270
    case 'top left':
      return 315
    default:
      return 180
  }
}

export const COVER_GRADIENT_PALETTE = Object.fromEntries(
  Object.entries(COVER_GRADIENT_WALLPAPER).map(([key, value]) => [
    key,
    {
      key,
      label: formatPresetLabel(key),
      colors: (value as TWallpaperGradient).colors,
    },
  ]),
) as Record<string, TGradientPalette>

export const buildCoverGradientRecipe = (
  source: string,
  renderer = GRADIENT_RENDERER.LINEAR,
): TGradientRecipe => {
  const key = source in COVER_GRADIENT_WALLPAPER ? source : COVER_DEFAULT_GRADIENT.LIGHT
  const preset = COVER_GRADIENT_WALLPAPER[key] as TWallpaperGradient
  const base: TGradientRecipe = {
    version: 2,
    renderer: GRADIENT_RENDERER.LINEAR,
    preset: key,
    colors: [...preset.colors],
    angle: directionToAngle(preset.direction),
    spread: 58,
  }

  return buildGradientRecipeForRenderer(base, renderer)
}

export const createCoverBgConfig = (source: string = COVER_DEFAULT_GRADIENT.LIGHT): TBgConfig => {
  const gradient = buildCoverGradientRecipe(source)
  const preset = COVER_GRADIENT_WALLPAPER[source] as TWallpaperGradient | undefined

  return {
    customWallpaper: null,
    source,
    type: WALLPAPER_TYPE.GRADIENT,
    hasPattern: false,
    patternId: DEFAULT_WALLPAPER_PATTERN_ID,
    patternIntensity: 0,
    patternTone: WALLPAPER_PATTERN_TONE.DARK,
    hasTexture: false,
    gradient,
    blurIntensity: preset?.blurIntensity ?? 0,
    brightness: preset?.brightness ?? 100,
    saturation: preset?.saturation ?? 100,
    texture: { ...COVER_DEFAULT_TEXTURE },
    bgSize: WALLPAPER_BG_SIZE.COVER,
  }
}

export const createCoverBgThemeConfig = (): TBgThemeConfig => ({
  light: createCoverBgConfig(COVER_DEFAULT_GRADIENT.LIGHT),
  dark: createCoverBgConfig(COVER_DEFAULT_GRADIENT.DARK),
})

export const resolveCoverBgRenderSpec = (background: TBgConfig): TBgRenderSpec =>
  resolveBgRenderSpec(background, getBgRendererFallbackConfig(background))
